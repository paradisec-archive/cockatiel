import { useAppStore } from '@/lib/store';
import { AnnotationBlock } from './AnnotationBlock';
import type { TimelineViewport } from './Waveform';

interface AnnotationTierProps {
  label: string;
  viewport: TimelineViewport;
}

export const AnnotationTier = ({ label, viewport }: AnnotationTierProps) => {
  const segments = useAppStore((s) => s.segments);
  const selectedSegmentId = useAppStore((s) => s.selectedSegmentId);

  const { pixelsPerSecond, visibleStartTime } = viewport;

  return (
    <div className="flex min-h-[40px] items-stretch">
      <div className="flex w-[100px] shrink-0 items-center rounded-l-md border border-r-0 border-border bg-secondary px-2.5 font-mono text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>

      <div className="relative flex-1 overflow-hidden rounded-r-md border border-border bg-card">
        {segments.map((seg) => {
          const left = (seg.start - visibleStartTime) * pixelsPerSecond;
          const width = (seg.end - seg.start) * pixelsPerSecond;

          return <AnnotationBlock key={seg.id} annotation={seg} isSelected={seg.id === selectedSegmentId} left={left} width={width} />;
        })}
      </div>
    </div>
  );
};
