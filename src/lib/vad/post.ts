import type { VadConfig, VadSegment } from './types';

export const dropShortSegments = (segments: VadSegment[], minSpeechDuration: number): VadSegment[] => {
  return segments.filter((seg) => seg.end - seg.start >= minSpeechDuration);
};

export const splitLongSegments = (segments: VadSegment[], maxSpeechDuration: number): VadSegment[] => {
  const out: VadSegment[] = [];
  for (const seg of segments) {
    if (seg.end - seg.start <= maxSpeechDuration) {
      out.push(seg);
      continue;
    }
    let t = seg.start;
    while (t < seg.end) {
      const end = Math.min(t + maxSpeechDuration, seg.end);
      out.push({ end, start: t });
      t = end;
    }
  }
  return out;
};

export const applyPostProcessing = (segments: VadSegment[], config: VadConfig): VadSegment[] => {
  const dropped = dropShortSegments(segments, config.minSpeechDuration);
  return splitLongSegments(dropped, config.maxSpeechDuration);
};
