import { useEffect } from 'react';
import type { ClickContext } from '@/components/SegmentContextMenu';
import type { DesiredRegions, MediaPlayer } from '@/lib/media-player/types';
import { type Annotation, SegmentInspect } from '@/lib/segment-ops';
import { useAppStore } from '@/lib/store';

const toDesiredRegions = (segments: Annotation[], selectedId: string | null, loopOnSelect: boolean): DesiredRegions => ({
  loopOnSelect,
  segments: segments.map((s) => ({ end: s.end, id: s.id, speaker: s.speaker, start: s.start })),
  selectedId,
});

export const useMediaPlayerBridge = (player: MediaPlayer | null): { getClickContext: (e: React.MouseEvent) => ClickContext | null } => {
  const segments = useAppStore((s) => s.segments);
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);
  const loopOnSelect = useAppStore((s) => s.loopOnSelect);

  useEffect(() => {
    if (!player) {
      return;
    }
    return player.on((event) => {
      const store = useAppStore.getState();
      switch (event.type) {
        case 'region-selected':
          store.selectSegment(event.id);
          break;
        case 'region-cleared':
          store.selectSegment(null);
          break;
        case 'region-bounds-changed':
          store.updateSegmentBounds(event.id, event.start, event.end);
          // If the store rejected the drag, segments reference is unchanged —
          // React won't re-render, so re-sync here with the canonical state so
          // the adapter snaps the region back.
          player.syncRegions(toDesiredRegions(store.segments, store.selectedSegmentId, store.loopOnSelect));
          break;
      }
    });
  }, [player]);

  useEffect(() => {
    if (!player) {
      return;
    }
    player.syncRegions(toDesiredRegions(segments, selectedSegmentId, loopOnSelect));
  }, [player, segments, selectedSegmentId, loopOnSelect]);

  const getClickContext = (e: React.MouseEvent): ClickContext | null => {
    if (!player) {
      return null;
    }
    const time = player.clientXToTime(e.clientX);
    if (time === null) {
      return null;
    }
    const segment = SegmentInspect.findAtTime(useAppStore.getState().segments, time);
    return { segmentId: segment?.id ?? null, time };
  };

  return { getClickContext };
};
