import { useCallback, useRef } from 'react';
import { resampleTo16kMono } from '@/lib/audio-resample';
import { useAppStore } from '@/lib/store';
import { runEnergyVad, runSileroVad, type VadSegment } from '@/lib/vad-processor';
import { loadVadModule } from '@/lib/wasm-manager';

export const useAutoSegment = () => {
  const audioFileRef = useRef<File | null>(null);

  const processFile = useCallback(async (file: File) => {
    const store = useAppStore.getState();
    audioFileRef.current = file;

    store.setAppPhase('processing');
    store.setStatus('Reading file...');
    store.setProgress(0);

    let audioContext: AudioContext | null = null;
    try {
      store.setStatus('Decoding audio...');
      const arrayBuffer = await file.arrayBuffer();
      audioContext = new AudioContext();
      const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioContext.close();
      audioContext = null;

      store.setMediaFile(file.name, originalBuffer.duration);
      store.setProgress(0.1);

      const [samples16k, vadModule] = await Promise.all([
        resampleTo16kMono(originalBuffer),
        loadVadModule((status) => store.setStatus(status)).catch(() => null),
      ]);

      store.setProgress(0.3);
      store.setStatus('Segmenting audio...');

      // Read vadConfig fresh — user may have changed settings since processing started
      const { vadConfig } = useAppStore.getState();

      let segments: VadSegment[];
      if (vadModule) {
        segments = await runSileroVad(vadModule, samples16k, vadConfig, (fraction) => {
          store.setProgress(0.3 + fraction * 0.7);
        });
      } else {
        store.setStatus('WASM unavailable, using energy-based VAD...');
        segments = await runEnergyVad(samples16k, vadConfig, (fraction) => {
          store.setProgress(0.3 + fraction * 0.7);
        });
      }

      store.loadSegments(segments);
    } catch (error) {
      audioContext?.close();
      console.error('Auto-segment failed:', error);
      store.setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      store.setAppPhase('upload');
    }
  }, []);

  return { audioFileRef, processFile };
};
