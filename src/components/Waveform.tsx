import { useWavesurfer } from '@wavesurfer/react';
import { Loader2Icon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import MinimapPlugin from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import { getSpeakerColour } from '@/lib/constants';
import { SegmentInspect } from '@/lib/segment-ops';
import { useAppStore } from '@/lib/store';
import { type ClickContext, SegmentContextMenu } from './SegmentContextMenu';

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

  const segments = useAppStore((s) => s.segments);
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);

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

  // Diff segments against the last-synced snapshot so text-only edits don't
  // cause wavesurfer to tear down and re-add hundreds of region DOM nodes.
  const prevRegionDataRef = useRef(new Map<string, { start: number; end: number; speaker: number }>());
  useEffect(() => {
    if (!isReady) {
      return;
    }

    const prev = prevRegionDataRef.current;
    const current = new Map<string, { start: number; end: number; speaker: number }>();
    let changed = prev.size !== segments.length;
    for (const seg of segments) {
      const data = { start: seg.start, end: seg.end, speaker: seg.speaker };
      current.set(seg.id, data);
      if (!changed) {
        const before = prev.get(seg.id);
        if (!before || before.start !== data.start || before.end !== data.end || before.speaker !== data.speaker) {
          changed = true;
        }
      }
    }

    if (!changed) {
      return;
    }

    prevRegionDataRef.current = current;

    const regionMap = new Map(regions.getRegions().map((r) => [r.id, r]));

    for (const id of prev.keys()) {
      if (!current.has(id)) {
        regionMap.get(id)?.remove();
      }
    }

    for (const [id, next] of current) {
      const before = prev.get(id);
      const colour = getSpeakerColour(next.speaker);
      if (!before) {
        regions.addRegion({
          color: `${colour}30`,
          drag: true,
          end: next.end,
          id,
          resize: true,
          start: next.start,
        });
      } else if (before.start !== next.start || before.end !== next.end || before.speaker !== next.speaker) {
        regionMap.get(id)?.setOptions({ color: `${colour}30`, end: next.end, start: next.start });
      }
    }
  }, [regions, segments, isReady]);

  // Update only the selected region's highlight — avoids rebuilding all regions on click
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedSegmentId;

    if (!prev && !selectedSegmentId) {
      return;
    }

    const regionMap = new Map(regions.getRegions().map((r) => [r.id, r]));
    const speakerFor = (id: string) => segments.find((s) => s.id === id)?.speaker ?? 0;

    if (prev) {
      regionMap.get(prev)?.setOptions({ color: `${getSpeakerColour(speakerFor(prev))}30` });
    }
    if (selectedSegmentId) {
      regionMap.get(selectedSegmentId)?.setOptions({ color: `${getSpeakerColour(speakerFor(selectedSegmentId))}55` });
    }
  }, [regions, segments, selectedSegmentId, isReady]);

  // Region clicks → select segment and play it once; loop only if loopOnSelect is on.
  // Use a flag to prevent the `interaction` event from immediately clearing the selection.
  const regionClickedRef = useRef(false);
  const loopingRegionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!wavesurfer) {
      return;
    }

    const unsubRegionClick = regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      regionClickedRef.current = true;
      loopingRegionRef.current = region.id;
      useAppStore.getState().selectSegment(region.id);
      region.play();
    });

    // Loop / play-once: when playback leaves the active region, restart it
    // only if the user has opted into loop-on-select.
    const unsubRegionOut = regions.on('region-out', (region) => {
      if (region.id !== loopingRegionRef.current) {
        return;
      }
      if (!useAppStore.getState().loopOnSelect) {
        loopingRegionRef.current = null;
        return;
      }
      region.play();
    });

    const unsubClick = wavesurfer.on('interaction', () => {
      if (regionClickedRef.current) {
        regionClickedRef.current = false;
        return;
      }
      loopingRegionRef.current = null;
      useAppStore.getState().selectSegment(null);
    });

    // Sync drag/resize back to store. If the store rejects (overlap, out-of-bounds,
    // below-min-duration), its segments reference is unchanged — the reconciliation
    // effect won't fire — so snap the region back to canonical bounds here.
    const unsubRegionUpdated = regions.on('region-updated', (region) => {
      useAppStore.getState().updateSegmentBounds(region.id, region.start, region.end);
      const seg = useAppStore.getState().segments.find((s) => s.id === region.id);
      if (seg && (seg.start !== region.start || seg.end !== region.end)) {
        region.setOptions({ end: seg.end, start: seg.start });
      }
    });

    // Stop looping when user pauses
    const unsubPause = wavesurfer.on('pause', () => {
      loopingRegionRef.current = null;
    });

    return () => {
      unsubRegionClick();
      unsubRegionOut();
      unsubRegionUpdated();
      unsubClick();
      unsubPause();
    };
  }, [wavesurfer, regions]);

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

  const getClickContext = useCallback(
    (e: React.MouseEvent): ClickContext | null => {
      const container = containerRef.current;
      if (!wavesurfer || !container) {
        return null;
      }
      const duration = wavesurfer.getDuration();
      if (!duration) {
        return null;
      }
      const rect = container.getBoundingClientRect();
      const scrollLeft = wavesurfer.getScroll();
      // When unzoomed, minPxPerSec is 0 (fit-to-window). The true rendered width
      // lives in the shadow DOM, so the outer container's scrollWidth is useless
      // here — compute from the viewport width and duration instead.
      const configuredPxPerSec = wavesurfer.options.minPxPerSec ?? 0;
      const pxPerSec = configuredPxPerSec > 0 ? configuredPxPerSec : container.clientWidth / duration;
      const time = (e.clientX - rect.left + scrollLeft) / pxPerSec;
      const segment = SegmentInspect.findAtTime(useAppStore.getState().segments, time);
      return { segmentId: segment?.id ?? null, time };
    },
    [wavesurfer],
  );

  return (
    <WavesurferContext.Provider value={ctxValue}>
      <div className="space-y-0.5">
        <div className="flex items-stretch">
          <div className="flex w-[100px] shrink-0 items-center rounded-l-md border border-r-0 border-border bg-[var(--waveform-bg)] px-2.5 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/50">
            Waveform
          </div>
          <SegmentContextMenu getClickContext={getClickContext} className="min-w-0 flex-1">
            <div className="relative">
              <div ref={containerRef} className="min-h-[160px] overflow-hidden rounded-r-lg border border-border bg-[var(--waveform-bg)]" />
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
