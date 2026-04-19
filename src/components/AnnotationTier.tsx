import { useCallback, useRef } from 'react';
import { findSegmentAtTime, useAppStore } from '@/lib/store';
import { AnnotationBlock } from './AnnotationBlock';
import { type ClickContext, SegmentContextMenu } from './SegmentContextMenu';
import type { TimelineViewport } from './Waveform';

interface AnnotationTierProps {
  label: string;
  viewport: TimelineViewport;
}

// Fraction of the viewport width rendered outside the visible edges on each side
// so segments enter the DOM before they scroll in.
const VIEWPORT_BUFFER_RATIO = 0.25;

export const AnnotationTier = ({ label, viewport }: AnnotationTierProps) => {
  const segments = useAppStore((s) => s.segments);
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);
  const trackRef = useRef<HTMLDivElement>(null);

  const { pixelsPerSecond, visibleStartTime, visibleEndTime } = viewport;
  const buffer = (visibleEndTime - visibleStartTime) * VIEWPORT_BUFFER_RATIO;
  const startT = visibleStartTime - buffer;
  const endT = visibleEndTime + buffer;

  const getClickContext = useCallback(
    (e: React.MouseEvent): ClickContext | null => {
      const track = trackRef.current;
      if (!track || pixelsPerSecond <= 0) {
        return null;
      }
      const rect = track.getBoundingClientRect();
      const time = (e.clientX - rect.left) / pixelsPerSecond + visibleStartTime;
      const segment = findSegmentAtTime(useAppStore.getState().segments, time);
      return { segmentId: segment?.id ?? null, time };
    },
    [pixelsPerSecond, visibleStartTime],
  );

  return (
    <div className="flex min-h-[40px] items-stretch">
      <div className="flex w-[100px] shrink-0 items-center rounded-l-md border border-r-0 border-border bg-secondary px-2.5 font-mono text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>

      <SegmentContextMenu getClickContext={getClickContext} className="min-w-0 flex-1">
        <div ref={trackRef} className="relative h-full overflow-hidden rounded-r-md border border-border bg-card">
          {segments
            .filter((seg) => seg.id === selectedSegmentId || (seg.end >= startT && seg.start <= endT))
            .map((seg) => {
              const left = (seg.start - visibleStartTime) * pixelsPerSecond;
              const width = (seg.end - seg.start) * pixelsPerSecond;

              return <AnnotationBlock key={seg.id} annotation={seg} isSelected={seg.id === selectedSegmentId} left={left} width={width} />;
            })}
        </div>
      </SegmentContextMenu>
    </div>
  );
};
