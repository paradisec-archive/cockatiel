import { useWavesurfer } from '@wavesurfer/react';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import { getSpeakerColour } from '@/lib/constants';
import { useAppStore } from '@/lib/store';

interface WavesurferContextValue {
  isReady: boolean;
  wavesurfer: WaveSurfer | null;
}

const WavesurferContext = createContext<WavesurferContextValue>({ isReady: false, wavesurfer: null });

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

  const segments = useAppStore((s) => s.segments);
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);

  const regions = useMemo(() => RegionsPlugin.create(), []);
  const zoom = useMemo(() => ZoomPlugin.create({ exponentialZooming: true, iterations: 30, scale: 0.5 }), []);
  const plugins = useMemo(() => [regions, zoom], [regions, zoom]);

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
    cursorColor: 'oklch(0.72 0.155 60)',
    cursorWidth: 2,
    height: 160,
    normalize: true,
    plugins,
    progressColor: 'oklch(0.65 0.12 65)',
    waveColor: 'oklch(0.75 0.145 65)',
  });

  // Load audio via loadBlob — avoids blob URL lifecycle issues with StrictMode.
  // The hook's internal `ready` event listener sets isReady for us.
  const loadedFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (!wavesurfer || !audioFile) return;
    if (loadedFileRef.current === audioFile) return;
    loadedFileRef.current = audioFile;

    wavesurfer.loadBlob(audioFile).catch((err: unknown) => {
      console.error('Failed to load audio:', err);
      useAppStore.getState().setStatus(`Error loading audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      useAppStore.getState().setAppPhase('upload');
    });
  }, [wavesurfer, audioFile]);

  // Rebuild regions when segments change
  useEffect(() => {
    if (!isReady) return;

    regions.clearRegions();
    for (const seg of segments) {
      const colour = getSpeakerColour(seg.speaker);
      regions.addRegion({
        color: `${colour}25`,
        drag: false,
        end: seg.end,
        id: seg.id,
        resize: false,
        start: seg.start,
      });
    }
  }, [regions, segments, isReady]);

  // Update only the selected region's highlight — avoids rebuilding all regions on click
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isReady) return;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedSegmentId;

    for (const region of regions.getRegions()) {
      if (region.id === prev) {
        const colour = getSpeakerColour(segments.find((s) => s.id === prev)?.speaker ?? 0);
        region.setOptions({ color: `${colour}25` });
      }
      if (region.id === selectedSegmentId) {
        const colour = getSpeakerColour(segments.find((s) => s.id === selectedSegmentId)?.speaker ?? 0);
        region.setOptions({ color: `${colour}40` });
      }
    }
  }, [regions, segments, selectedSegmentId, isReady]);

  // Region clicks → select segment + play.
  // Use a flag to prevent the `interaction` event from immediately clearing the selection.
  const regionClickedRef = useRef(false);
  useEffect(() => {
    if (!wavesurfer) return;

    const unsubRegionClick = regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      regionClickedRef.current = true;
      useAppStore.getState().selectSegment(region.id);
      region.play();
    });

    const unsubClick = wavesurfer.on('interaction', () => {
      if (regionClickedRef.current) {
        regionClickedRef.current = false;
        return;
      }
      useAppStore.getState().selectSegment(null);
    });

    return () => {
      unsubRegionClick();
      unsubClick();
    };
  }, [wavesurfer, regions]);

  // Viewport sync — keep annotation tier aligned with waveform.
  // The `scroll` event fires on both scroll and zoom with (visibleStartTime, visibleEndTime).
  // We also emit on `ready` for the initial alignment.
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  useEffect(() => {
    if (!wavesurfer) return;

    const emitViewport = (visibleStartTime: number, visibleEndTime: number) => {
      if (!containerRef.current) return;
      const pps = containerRef.current.clientWidth / (visibleEndTime - visibleStartTime || 1);
      onViewportChangeRef.current?.({ pixelsPerSecond: pps, visibleEndTime, visibleStartTime });
    };

    const emitFullViewport = () => {
      const duration = wavesurfer.getDuration();
      if (duration > 0) emitViewport(0, duration);
    };

    const unsubScroll = wavesurfer.on('scroll', emitViewport);
    const unsubReady = wavesurfer.on('ready', emitFullViewport);

    // If audio is already loaded (e.g. effect re-ran after StrictMode), emit now
    if (wavesurfer.getDuration() > 0) emitFullViewport();

    return () => {
      unsubScroll();
      unsubReady();
    };
  }, [wavesurfer]);

  const ctxValue = useMemo(() => ({ isReady, wavesurfer }), [wavesurfer, isReady]);

  return (
    <WavesurferContext.Provider value={ctxValue}>
      <div className="space-y-0.5">
        <div className="flex items-stretch">
          <div className="flex w-[100px] shrink-0 items-center rounded-l-md border border-r-0 border-border bg-[var(--waveform-bg)] px-2.5 font-mono text-[0.65rem] uppercase tracking-widest text-white/30">
            Waveform
          </div>
          <div ref={containerRef} className="flex-1 overflow-hidden rounded-r-lg border border-border bg-[var(--waveform-bg)]" />
        </div>
        {children}
      </div>
    </WavesurferContext.Provider>
  );
};
