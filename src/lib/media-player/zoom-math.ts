export const MAX_PX_PER_SEC = 500;

const PADDING_RATIO = 0.1;

interface ZoomWindow {
  pxPerSec: number;
  scroll: number;
}

export const computeZoomWindow = (containerWidth: number, duration: number, segStart: number, segEnd: number): ZoomWindow | null => {
  if (containerWidth <= 0 || duration <= 0) {
    return null;
  }
  const segSpan = segEnd - segStart;
  if (segSpan <= 0) {
    return null;
  }
  const padding = segSpan * PADDING_RATIO;
  const windowStart = Math.max(0, segStart - padding);
  const windowEnd = Math.min(duration, segEnd + padding);
  const windowSpan = windowEnd - windowStart;
  if (windowSpan <= 0) {
    return null;
  }
  const pxPerSec = Math.min(MAX_PX_PER_SEC, containerWidth / windowSpan);
  return { pxPerSec, scroll: windowStart * pxPerSec };
};

const clamp01 = (v: number) => Math.max(0, Math.min(100, v));

export const toSliderValue = (px: number, minPx: number): number => {
  if (minPx <= 0 || px <= minPx) {
    return 0;
  }
  return clamp01((Math.log(px / minPx) / Math.log(MAX_PX_PER_SEC / minPx)) * 100);
};

export const fromSliderValue = (value: number, minPx: number): number => {
  if (minPx <= 0) {
    return 0;
  }
  return minPx * (MAX_PX_PER_SEC / minPx) ** (clamp01(value) / 100);
};
