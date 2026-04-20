import { useWavesurfer } from '@wavesurfer/react';
import { Loader2Icon } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import MinimapPlugin from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import { useWaveformSegments } from '@/hooks/useWaveformSegments';
import { useAppStore } from '@/lib/store';
import { SegmentContextMenu } from './SegmentContextMenu';

interface WavesurferContextValue {
  containerRef: React.RefObject<HTMLDivElement | null> | null;
  isReady: boolean;
  wavesurfer: WaveSurfer | null;
}

const WavesurferContext = createContext<WavesurferContextValue>({ containerRef: null, isReady: false, wavesurfer: null });

export const useWavesurferContext = () => {
  return useContext(WavesurferContext);
};

export interface TimelineViewport {
  pixelsPerSecond: number;
  visibleEndTime: number;
  visibleStartTime: number;
}

interface WaveformProps {
  audioFile: File | null;
  children?: React.ReactNode;
  onViewportChange?: (viewport: TimelineViewport) => void;
}

export const Waveform = ({ audioFile, children, onViewportChange }: WaveformProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const regions = useMemo(() => RegionsPlugin.create(), []);
  const zoom = useMemo(() => ZoomPlugin.create({ exponentialZooming: true, iterations: 30, scale: 0.5 }), []);
  const minimap = useMemo(
    () =>
      MinimapPlugin.create({
        height: 32,
        overlayColor: 'oklch(0.45 0.05 55 / 30%)',
        waveColor: 'oklch(0.65 0.04 55)',
        progressColor: 'oklch(0.45 0.08 55)',
      }),
    [],
  );
  const plugins = useMemo(() => [regions, zoom, minimap], [regions, zoom, minimap]);

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
    cursorColor: 'oklch(0.45 0.18 25)',
    cursorWidth: 2,
    height: 160,
    normalize: true,
    plugins,
    progressColor: 'oklch(0.35 0.12 55)',
    waveColor: 'oklch(0.55 0.06 55)',
  });

  // Load audio via loadBlob — avoids blob URL lifecycle issues with StrictMode.
  // The hook's internal `ready` event listener sets isReady for us.
  const loadedFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (!wavesurfer || !audioFile) {
      return;
    }
    if (loadedFileRef.current === audioFile) {
      return;
    }
    loadedFileRef.current = audioFile;

    wavesurfer.loadBlob(audioFile).catch((err: unknown) => {
      console.error('Failed to load audio:', err);
      useAppStore.getState().setStatus(`Error loading audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      useAppStore.getState().setAppPhase('upload');
    });
  }, [wavesurfer, audioFile]);

  const { getClickContext } = useWaveformSegments(wavesurfer, regions, containerRef, isReady);

  // Viewport sync — keep annotation tier aligned with waveform.
  // The `scroll` event fires on both scroll and zoom with (visibleStartTime, visibleEndTime).
  // We also emit on `ready` for the initial alignment.
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  useEffect(() => {
    if (!wavesurfer) {
      return;
    }

    const doEmit = (visibleStartTime: number, visibleEndTime: number) => {
      if (!containerRef.current) {
        return;
      }
      const pps = containerRef.current.clientWidth / (visibleEndTime - visibleStartTime || 1);
      onViewportChangeRef.current?.({ pixelsPerSecond: pps, visibleEndTime, visibleStartTime });
    };

    // Wavesurfer emits `scroll` at a high rate during zoom drags. Coalesce
    // into at most one emission per animation frame — the downstream tier
    // re-render is the expensive part.
    let rafId: number | null = null;
    let pending: [number, number] | null = null;

    const emitViewport = (visibleStartTime: number, visibleEndTime: number) => {
      pending = [visibleStartTime, visibleEndTime];
      if (rafId !== null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!pending) {
          return;
        }
        const [s, e] = pending;
        pending = null;
        doEmit(s, e);
      });
    };

    const emitFullViewport = () => {
      const duration = wavesurfer.getDuration();
      if (duration > 0) {
        doEmit(0, duration);
      }
    };

    const unsubScroll = wavesurfer.on('scroll', emitViewport);
    const unsubReady = wavesurfer.on('ready', emitFullViewport);

    // If audio is already loaded (e.g. effect re-ran after StrictMode), emit now
    if (wavesurfer.getDuration() > 0) {
      emitFullViewport();
    }

    return () => {
      unsubScroll();
      unsubReady();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [wavesurfer]);

  const ctxValue = useMemo(() => ({ containerRef, isReady, wavesurfer }), [wavesurfer, isReady]);

  return (
    <WavesurferContext.Provider value={ctxValue}>
      <div className="space-y-0.5">
        <div className="flex items-stretch">
          <div className="flex w-25 shrink-0 items-center rounded-l-md border border-r-0 border-border bg-waveform-bg px-2.5 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/50">
            Waveform
          </div>

          <SegmentContextMenu getClickContext={getClickContext} className="min-w-0 flex-1">
            <div className="relative">
              <div ref={containerRef} className="min-h-40 overflow-hidden rounded-r-lg border border-border bg-waveform-bg" />
              {!isReady && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2Icon className="size-5 animate-spin" />
                  <span className="font-mono text-xs uppercase tracking-widest">Loading audio…</span>
                </div>
              )}
            </div>
          </SegmentContextMenu>
        </div>

        {children}
      </div>
    </WavesurferContext.Provider>
  );
};
