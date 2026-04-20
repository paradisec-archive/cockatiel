import { useEffect, useRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import type RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { ClickContext } from '@/components/SegmentContextMenu';
import { getSpeakerColour } from '@/lib/constants';
import type { DesiredState, RegionSync } from '@/lib/region-sync/types';
import { createWavesurferRegionSync } from '@/lib/region-sync/wavesurfer';
import { type Annotation, SegmentInspect } from '@/lib/segment-ops';
import { useAppStore } from '@/lib/store';

type RegionSyncFactory = (ws: WaveSurfer, regions: RegionsPlugin, container: HTMLElement, colourFor: (speaker: number) => string) => RegionSync;

interface UseWaveformSegmentsOptions {
  factory?: RegionSyncFactory;
}

const toDesiredState = (segments: Annotation[], selectedId: string | null, loopOnSelect: boolean): DesiredState => ({
  loopOnSelect,
  segments: segments.map((s) => ({ end: s.end, id: s.id, speaker: s.speaker, start: s.start })),
  selectedId,
});

const currentDesiredState = (): DesiredState => {
  const { loopOnSelect, segments, selectedSegmentId } = useAppStore.getState();
  return toDesiredState(segments, selectedSegmentId, loopOnSelect);
};

export const useWaveformSegments = (
  wavesurfer: WaveSurfer | null,
  regions: RegionsPlugin,
  containerRef: React.RefObject<HTMLDivElement | null>,
  isReady: boolean,
  options?: UseWaveformSegmentsOptions,
): { getClickContext: (e: React.MouseEvent) => ClickContext | null } => {
  const factoryRef = useRef<RegionSyncFactory>(createWavesurferRegionSync);
  factoryRef.current = options?.factory ?? createWavesurferRegionSync;

  const portRef = useRef<RegionSync | null>(null);

  const segments = useAppStore((s) => s.segments);
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);
  const loopOnSelect = useAppStore((s) => s.loopOnSelect);

  useEffect(() => {
    const container = containerRef.current;
    if (!wavesurfer || !container || !isReady) {
      return;
    }

    const port = factoryRef.current(wavesurfer, regions, container, getSpeakerColour);
    portRef.current = port;
    port.sync(currentDesiredState());

    const unsubscribe = port.on((event) => {
      const store = useAppStore.getState();
      switch (event.type) {
        case 'selected': {
          store.selectSegment(event.id);
          break;
        }
        case 'cleared': {
          store.selectSegment(null);
          break;
        }
        case 'bounds-changed': {
          store.updateSegmentBounds(event.id, event.start, event.end);
          // If the store rejected the drag, segments reference is unchanged —
          // React won't re-render, so re-sync here with the canonical state so
          // the adapter snaps the region back.
          port.sync(currentDesiredState());
          break;
        }
      }
    });

    return () => {
      unsubscribe();
      port.dispose();
      portRef.current = null;
    };
  }, [wavesurfer, regions, containerRef, isReady]);

  useEffect(() => {
    const port = portRef.current;
    if (!port) {
      return;
    }
    port.sync(toDesiredState(segments, selectedSegmentId, loopOnSelect));
  }, [segments, selectedSegmentId, loopOnSelect]);

  const getClickContext = (e: React.MouseEvent): ClickContext | null => {
    const port = portRef.current;
    if (!port) {
      return null;
    }
    const time = port.clientXToTime(e.clientX);
    if (time === null) {
      return null;
    }
    const segment = SegmentInspect.findAtTime(useAppStore.getState().segments, time);
    return { segmentId: segment?.id ?? null, time };
  };

  return { getClickContext };
};
