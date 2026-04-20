import { describe, expect, it } from 'vitest';
import { computeZoomWindow, fromSliderValue, MAX_PX_PER_SEC, toSliderValue } from '@/lib/media-player/zoom-math';

describe('computeZoomWindow', () => {
  it('returns null when container width is zero', () => {
    expect(computeZoomWindow(0, 60, 10, 20)).toBeNull();
  });

  it('returns null when duration is zero', () => {
    expect(computeZoomWindow(500, 0, 10, 20)).toBeNull();
  });

  it('returns null when segment span is zero or negative', () => {
    expect(computeZoomWindow(500, 60, 10, 10)).toBeNull();
    expect(computeZoomWindow(500, 60, 20, 10)).toBeNull();
  });

  it('adds 10% padding on each side within duration bounds', () => {
    // seg [20,30], span 10, padding 1, window [19,31], span 12 → 500/12 ≈ 41.666…
    const result = computeZoomWindow(500, 60, 20, 30);
    expect(result).not.toBeNull();
    expect(result?.pxPerSec).toBeCloseTo(500 / 12, 5);
    expect(result?.scroll).toBeCloseTo(19 * (500 / 12), 5);
  });

  it('clamps the padded window start at zero', () => {
    // seg [0,10], padding would put windowStart at -1 → clamped to 0.
    const result = computeZoomWindow(500, 60, 0, 10);
    expect(result?.scroll).toBe(0);
  });

  it('clamps the padded window end at duration', () => {
    // seg [55,60], padding pushes windowEnd past duration → clamp to 60.
    const result = computeZoomWindow(500, 60, 55, 60);
    expect(result).not.toBeNull();
    // windowStart = 55 - 0.5 = 54.5, windowEnd = 60, windowSpan = 5.5
    expect(result?.pxPerSec).toBeCloseTo(500 / 5.5, 5);
  });

  it('clamps pxPerSec to MAX_PX_PER_SEC for very tight segments', () => {
    // Tiny segment in a wide container: raw pxPerSec would be huge.
    const result = computeZoomWindow(10000, 60, 10, 10.01);
    expect(result?.pxPerSec).toBe(MAX_PX_PER_SEC);
  });
});

describe('toSliderValue / fromSliderValue', () => {
  const minPx = 10;

  it('returns 0 when px equals minPx', () => {
    expect(toSliderValue(minPx, minPx)).toBe(0);
  });

  it('returns 100 when px equals MAX_PX_PER_SEC', () => {
    expect(toSliderValue(MAX_PX_PER_SEC, minPx)).toBe(100);
  });

  it('round-trips between slider and px (log scale)', () => {
    for (const v of [0, 10, 25, 50, 75, 100]) {
      const px = fromSliderValue(v, minPx);
      expect(toSliderValue(px, minPx)).toBeCloseTo(v, 5);
    }
  });

  it('clamps slider outputs to [0, 100]', () => {
    expect(toSliderValue(minPx / 2, minPx)).toBe(0);
    expect(toSliderValue(MAX_PX_PER_SEC * 2, minPx)).toBe(100);
  });

  it('clamps slider inputs to [0, 100] for fromSliderValue', () => {
    expect(fromSliderValue(-10, minPx)).toBe(minPx);
    expect(fromSliderValue(150, minPx)).toBe(MAX_PX_PER_SEC);
  });

  it('returns zero from fromSliderValue when minPx is zero', () => {
    expect(fromSliderValue(50, 0)).toBe(0);
  });

  it('returns zero from toSliderValue when minPx is zero', () => {
    expect(toSliderValue(100, 0)).toBe(0);
  });
});
