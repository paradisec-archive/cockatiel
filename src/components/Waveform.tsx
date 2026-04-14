import { useWavesurfer } from '@wavesurfer/react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
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
  const [isReady, setIsReady] = useState(false);

  const segments = useAppStore((s) => s.segments);
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);

  const regions = useMemo(() => RegionsPlugin.create(), []);

  const { wavesurfer } = useWavesurfer({
    container: containerRef,
    cursorColor: 'oklch(0.72 0.155 60)',
    cursorWidth: 2,
    height: 160,
    normalize: true,
    plugins: [regions],
    progressColor: 'oklch(0.65 0.12 65)',
    waveColor: 'oklch(0.75 0.145 65)',
  });

  // Load audio when file changes — with cleanup for unmount during load
  useEffect(() => {
    if (!wavesurfer || !audioFile) return;
    let cancelled = false;
    wavesurfer
      .loadBlob(audioFile)
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load audio:', err);
          useAppStore.getState().setStatus(`Error loading audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
          useAppStore.getState().setAppPhase('upload');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wavesurfer, audioFile]);

  // Sync regions with store segments + highlight selected (merged into single effect)
  useEffect(() => {
    if (!isReady) return;

    regions.clearRegions();
    for (const seg of segments) {
      const colour = getSpeakerColour(seg.speaker);
      const isSelected = seg.id === selectedSegmentId;
      regions.addRegion({
        color: isSelected ? `${colour}40` : `${colour}25`,
        drag: false,
        end: seg.end,
        id: seg.id,
        resize: false,
        start: seg.start,
      });
    }
  }, [regions, segments, selectedSegmentId, isReady]);

  // Region clicks → select segment + play
  useEffect(() => {
    if (!wavesurfer) return;

    const unsubRegionClick = regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      useAppStore.getState().selectSegment(region.id);
      region.play();
    });

    const unsubClick = wavesurfer.on('interaction', () => {
      useAppStore.getState().selectSegment(null);
    });

    return () => {
      unsubRegionClick();
      unsubClick();
    };
  }, [wavesurfer, regions]);

  // Viewport changes for annotation tier sync
  useEffect(() => {
    if (!wavesurfer) return;

    const unsubScroll = wavesurfer.on('scroll', (visibleStartTime: number, visibleEndTime: number) => {
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const pps = containerWidth / (visibleEndTime - visibleStartTime || 1);
      onViewportChange?.({ pixelsPerSecond: pps, visibleEndTime, visibleStartTime });
    });

    const unsubZoom = wavesurfer.on('zoom', (minPxPerSec: number) => {
      const duration = wavesurfer.getDuration();
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const visibleDuration = containerWidth / minPxPerSec;
      const currentTime = wavesurfer.getCurrentTime();
      const visibleStartTime = Math.max(0, currentTime - visibleDuration / 2);
      const visibleEndTime = Math.min(duration, visibleStartTime + visibleDuration);
      onViewportChange?.({ pixelsPerSecond: minPxPerSec, visibleEndTime, visibleStartTime });
    });

    return () => {
      unsubScroll();
      unsubZoom();
    };
  }, [wavesurfer, onViewportChange]);

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
