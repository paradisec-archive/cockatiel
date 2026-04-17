import type WaveSurfer from 'wavesurfer.js';

export const MAX_PX_PER_SEC = 500;

const PADDING_RATIO = 0.1;

export const zoomToSegment = (wavesurfer: WaveSurfer, viewportWidth: number, segStart: number, segEnd: number) => {
  if (viewportWidth <= 0) {
    return;
  }
  const duration = wavesurfer.getDuration();
  const segSpan = segEnd - segStart;
  if (segSpan <= 0 || duration <= 0) {
    return;
  }
  const padding = segSpan * PADDING_RATIO;
  const windowStart = Math.max(0, segStart - padding);
  const windowEnd = Math.min(duration, segEnd + padding);
  const windowSpan = windowEnd - windowStart;
  if (windowSpan <= 0) {
    return;
  }
  const pxPerSec = Math.min(MAX_PX_PER_SEC, viewportWidth / windowSpan);
  wavesurfer.zoom(pxPerSec);
  wavesurfer.setScroll(windowStart * pxPerSec);
};
