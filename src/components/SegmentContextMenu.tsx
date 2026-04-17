import { type ReactNode, useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { type Annotation, canSplitAt, sortByStart, useAppStore } from '@/lib/store';

const NEW_SEGMENT_DURATION = 1.0;

export interface ClickContext {
  segmentId: string | null;
  time: number;
}

interface SegmentContextMenuProps {
  children: ReactNode;
  className?: string;
  getClickContext: (e: React.MouseEvent) => ClickContext | null;
}

const nearestSpeaker = (sorted: Annotation[], time: number, fallback: number) => {
  if (!sorted.length) {
    return fallback;
  }
  let nearest = sorted[0];
  let nearestDist = Math.abs(time - (nearest.start + nearest.end) / 2);
  for (const seg of sorted) {
    const dist = Math.abs(time - (seg.start + seg.end) / 2);
    if (dist < nearestDist) {
      nearest = seg;
      nearestDist = dist;
    }
  }
  return nearest.speaker;
};

const computeNewSegmentBounds = (sorted: Annotation[], time: number, duration: number) => {
  const half = NEW_SEGMENT_DURATION / 2;
  let start = Math.max(0, time - half);
  let end = Math.min(duration, time + half);
  for (const seg of sorted) {
    if (seg.end <= time && seg.end > start) {
      start = seg.end;
    }
    if (seg.start >= time && seg.start < end) {
      end = seg.start;
    }
  }
  return { end, start };
};

export const SegmentContextMenu = ({ children, className, getClickContext }: SegmentContextMenuProps) => {
  const [ctx, setCtx] = useState<ClickContext | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    const next = getClickContext(e);
    if (!next) {
      return;
    }
    setCtx(next);
    if (next.segmentId) {
      useAppStore.getState().selectSegment(next.segmentId);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className} onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>{ctx && <MenuBody ctx={ctx} />}</ContextMenuContent>
    </ContextMenu>
  );
};

const MenuBody = ({ ctx }: { ctx: ClickContext }) => {
  const segments = useAppStore((s) => s.segments);
  const speakerNames = useAppStore((s) => s.speakerNames);
  const mediaDuration = useAppStore((s) => s.mediaDuration);
  const defaultSpeaker = useAppStore((s) => s.defaultSpeaker);

  const sorted = sortByStart(segments);

  if (ctx.segmentId !== null) {
    const { segmentId } = ctx;
    const idx = sorted.findIndex((s) => s.id === segmentId);
    const seg = idx === -1 ? null : sorted[idx];
    const hasPrev = idx > 0;
    const hasNext = idx !== -1 && idx < sorted.length - 1;
    const canSplit = !!seg && canSplitAt(seg, ctx.time);

    return (
      <>
        <ContextMenuItem
          disabled={!canSplit}
          title={canSplit ? undefined : 'Click inside the segment to split it'}
          onClick={() => useAppStore.getState().splitSegment(segmentId, ctx.time)}
        >
          Split here
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={speakerNames.length <= 1}>Assign speaker</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {speakerNames.map((name, i) => (
              <ContextMenuItem key={name} onClick={() => useAppStore.getState().assignSpeaker(segmentId, i)}>
                {name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          disabled={!hasNext}
          title={hasNext ? undefined : 'No following segment to merge with'}
          onClick={() => useAppStore.getState().mergeWithNext(segmentId)}
        >
          Merge with next
          <ContextMenuShortcut>M</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasPrev}
          title={hasPrev ? undefined : 'No preceding segment to merge with'}
          onClick={() => useAppStore.getState().mergeWithPrevious(segmentId)}
        >
          Merge with previous
          <ContextMenuShortcut>Shift+M</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => useAppStore.getState().deleteSegment(segmentId)}>
          Delete segment
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </>
    );
  }

  const bounds = computeNewSegmentBounds(sorted, ctx.time, mediaDuration);
  const valid = bounds.end - bounds.start > 0.05;
  const speaker = nearestSpeaker(sorted, ctx.time, defaultSpeaker);

  return (
    <ContextMenuItem
      disabled={!valid}
      title={valid ? undefined : 'Not enough space here for a new segment'}
      onClick={() => useAppStore.getState().createSegment(bounds.start, bounds.end, speaker)}
    >
      New segment here
    </ContextMenuItem>
  );
};
