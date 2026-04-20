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
import { type InspectCtx, rejectionMessage, SegmentInspect, type SegmentState } from '@/lib/segment-ops';
import { useAppStore } from '@/lib/store';
import { zoomToSegment } from '@/lib/zoom';
import { useWavesurferContext } from './Waveform';

export interface ClickContext {
  segmentId: string | null;
  time: number;
}

interface SegmentContextMenuProps {
  children: ReactNode;
  className?: string;
  getClickContext: (e: React.MouseEvent) => ClickContext | null;
}

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
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);
  const speakerNames = useAppStore((s) => s.speakerNames);
  const mediaDuration = useAppStore((s) => s.mediaDuration);
  const defaultSpeaker = useAppStore((s) => s.defaultSpeaker);
  const { wavesurfer, containerRef } = useWavesurferContext();

  const state: SegmentState = { segments, selectedSegmentId };
  const inspectCtx: InspectCtx = { defaultSpeaker, mediaDuration, speakerCount: speakerNames.length };

  if (ctx.segmentId !== null) {
    const { segmentId } = ctx;
    const seg = segments.find((s) => s.id === segmentId);
    const splitReason = SegmentInspect.split(state, segmentId, ctx.time);
    const mergeNextReason = SegmentInspect.mergeNext(state, segmentId);
    const mergePrevReason = SegmentInspect.mergePrev(state, segmentId);
    const canZoom = !!seg && !!wavesurfer;

    return (
      <>
        <ContextMenuItem
          disabled={splitReason !== null}
          title={splitReason ? rejectionMessage(splitReason) : undefined}
          onClick={() => useAppStore.getState().splitSegment(segmentId, ctx.time)}
        >
          Split here
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!canZoom}
          onClick={() => {
            if (!seg || !wavesurfer) {
              return;
            }
            zoomToSegment(wavesurfer, containerRef?.current?.clientWidth ?? 0, seg.start, seg.end);
          }}
        >
          Zoom here
          <ContextMenuShortcut>Z</ContextMenuShortcut>
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
          disabled={mergeNextReason !== null}
          title={mergeNextReason ? rejectionMessage(mergeNextReason) : undefined}
          onClick={() => useAppStore.getState().mergeWithNext(segmentId)}
        >
          Merge with next
          <ContextMenuShortcut>M</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={mergePrevReason !== null}
          title={mergePrevReason ? rejectionMessage(mergePrevReason) : undefined}
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

  const createReason = SegmentInspect.createAt(state, ctx.time, inspectCtx);
  const bounds = SegmentInspect.proposedBoundsAt(segments, ctx.time, mediaDuration);
  const speaker = SegmentInspect.nearestSpeaker(segments, ctx.time, defaultSpeaker);

  return (
    <ContextMenuItem
      disabled={createReason !== null}
      title={createReason ? rejectionMessage(createReason) : undefined}
      onClick={() => {
        if (!bounds) {
          return;
        }
        useAppStore.getState().createSegment(bounds.start, bounds.end, speaker);
      }}
    >
      New segment here
    </ContextMenuItem>
  );
};
