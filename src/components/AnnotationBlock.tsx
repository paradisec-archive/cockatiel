import { memo, useCallback } from 'react';
import { getSpeakerColour } from '@/lib/constants';
import { type Annotation, useAppStore } from '@/lib/store';

interface AnnotationBlockProps {
  annotation: Annotation;
  isSelected: boolean;
  left: number;
  width: number;
}

export const AnnotationBlock = memo(function AnnotationBlock({ annotation, isSelected, left, width }: AnnotationBlockProps) {
  const updateSegmentText = useAppStore((s) => s.updateSegmentText);
  const selectSegment = useAppStore((s) => s.selectSegment);

  const colour = getSpeakerColour(annotation.speaker);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSegmentText(annotation.id, e.target.value);
    },
    [annotation.id, updateSegmentText],
  );

  const handleClick = useCallback(() => {
    selectSegment(annotation.id);
  }, [annotation.id, selectSegment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleClick();
      }
    },
    [handleClick],
  );

  if (width < 2) {
    return null;
  }

  const bgColour = `${colour}18`;
  const borderColour = isSelected ? colour : 'oklch(0 0 0 / 12%)';
  const shadow = isSelected ? `0 0 0 1px ${colour}` : undefined;

  return (
    // biome-ignore lint/a11y/useSemanticElements: contains interactive child (input) — can't be a <button>
    <div
      role="button"
      tabIndex={0}
      className={`absolute top-[3px] bottom-[3px] flex cursor-pointer items-center gap-1 overflow-hidden rounded-sm border transition-all ${isSelected ? 'z-10 shadow-sm' : ''}`}
      style={{
        background: bgColour,
        borderColor: borderColour,
        borderLeftColor: colour,
        borderLeftWidth: '3px',
        boxShadow: shadow,
        left: `${left}px`,
        width: `${width}px`,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {width > 30 && (
        <input
          type="text"
          value={annotation.value}
          onChange={handleTextChange}
          onClick={(e) => e.stopPropagation()}
          placeholder="..."
          className="min-w-0 flex-1 border-none bg-transparent px-1.5 py-0 font-sans text-[0.75rem] text-foreground outline-none placeholder:italic placeholder:text-muted-foreground/50"
        />
      )}
    </div>
  );
});
