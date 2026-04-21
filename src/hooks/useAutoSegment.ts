import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { resampleTo16kMono } from '@/lib/audio-resample';
import { sha256Hex } from '@/lib/persistence/fingerprint';
import { loadSession } from '@/lib/persistence/storage';
import { useAppStore } from '@/lib/store';
import { segment } from '@/lib/vad';

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export const useAutoSegment = () => {
  const audioFileRef = useRef<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const processFile = useCallback(async (file: File) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const store = useAppStore.getState();
    const prevFingerprint = store.fingerprint;
    const prevFileName = store.mediaFileName;
    audioFileRef.current = file;

    store.setAppPhase('processing');
    store.setStatus('Reading file...');
    store.setProgress(0);

    let audioContext: AudioContext | null = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      store.setStatus('Verifying file...');
      const fingerprint = await sha256Hex(arrayBuffer);
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const existing = await loadSession(fingerprint);
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const switchedAway = prevFingerprint !== '' && prevFingerprint !== fingerprint;

      if (existing) {
        store.hydrateFromStoredSession(existing);
        if (file.name !== existing.mediaFileName) {
          store.setMediaFile(file.name, existing.mediaDuration);
        }
        store.setAppPhase('ready');
        store.setStatus('');
        store.setProgress(0);
        if (switchedAway) {
          toast.info(`Switched to saved session for "${existing.mediaFileName}".`);
        }
        return;
      }

      if (switchedAway) {
        toast.info(`Starting a new session. Your saved work on "${prevFileName}" is still available.`);
      }

      store.setStatus('Decoding audio...');
      audioContext = new AudioContext();
      const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioContext.close();
      audioContext = null;

      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      store.setMediaFile(file.name, originalBuffer.duration);
      store.setFingerprint(fingerprint);
      store.setProgress(0.1);

      const samples16k = await resampleTo16kMono(originalBuffer);
      store.setProgress(0.3);
      store.setStatus('Segmenting audio...');

      // Read vadConfig fresh — user may have changed settings since processing started
      const { vadConfig } = useAppStore.getState();

      const segments = await segment(samples16k, vadConfig, {
        onProgress: (fraction) => store.setProgress(0.3 + fraction * 0.7),
        onStatus: (msg) => store.setStatus(msg),
        signal,
      });

      store.loadSegments(segments);
    } catch (error) {
      audioContext?.close();
      if (isAbortError(error)) {
        return;
      }
      console.error('Auto-segment failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Auto-segment failed: ${message}`);
      store.setAppPhase('upload');
    }
  }, []);

  return { audioFileRef, processFile };
};
