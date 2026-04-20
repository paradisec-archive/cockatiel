import { describe, expect, it } from 'vitest';
import { applyPostProcessing, dropShortSegments, splitLongSegments } from '@/lib/vad/post';
import type { VadConfig, VadSegment } from '@/lib/vad/types';

describe('dropShortSegments', () => {
  it('removes segments shorter than the threshold', () => {
    const input: VadSegment[] = [
      { end: 1.0, start: 0.0 }, // 1.0s — keep
      { end: 1.1, start: 1.0 }, // 0.1s — drop
      { end: 3.0, start: 2.0 }, // 1.0s — keep
    ];
    expect(dropShortSegments(input, 0.25)).toEqual([
      { end: 1.0, start: 0.0 },
      { end: 3.0, start: 2.0 },
    ]);
  });

  it('keeps segments exactly at the threshold', () => {
    const input: VadSegment[] = [{ end: 0.25, start: 0 }];
    expect(dropShortSegments(input, 0.25)).toEqual(input);
  });

  it('returns empty when all segments are too short', () => {
    const input: VadSegment[] = [
      { end: 0.1, start: 0 },
      { end: 0.3, start: 0.2 },
    ];
    expect(dropShortSegments(input, 0.25)).toEqual([]);
  });
});

describe('splitLongSegments', () => {
  it('leaves segments at or below the max untouched', () => {
    const input: VadSegment[] = [
      { end: 5, start: 0 },
      { end: 30, start: 10 }, // exactly 20s
    ];
    expect(splitLongSegments(input, 30)).toEqual(input);
  });

  it('splits a 75s segment into 30 + 30 + 15 chunks', () => {
    const input: VadSegment[] = [{ end: 75, start: 0 }];
    expect(splitLongSegments(input, 30)).toEqual([
      { end: 30, start: 0 },
      { end: 60, start: 30 },
      { end: 75, start: 60 },
    ]);
  });

  it('preserves segment ordering when mixing short and long inputs', () => {
    const input: VadSegment[] = [
      { end: 5, start: 0 },
      { end: 80, start: 10 },
      { end: 100, start: 85 },
    ];
    expect(splitLongSegments(input, 30)).toEqual([
      { end: 5, start: 0 },
      { end: 40, start: 10 },
      { end: 70, start: 40 },
      { end: 80, start: 70 },
      { end: 100, start: 85 },
    ]);
  });
});

describe('applyPostProcessing', () => {
  const config: VadConfig = {
    maxSpeechDuration: 30,
    minSilenceDuration: 0.3,
    minSpeechDuration: 0.25,
    threshold: 0.5,
  };

  it('drops short segments before splitting long ones', () => {
    const input: VadSegment[] = [
      { end: 0.1, start: 0 }, // short — dropped
      { end: 75, start: 1 }, // 74s — split into three
      { end: 80.1, start: 80 }, // short — dropped
    ];
    expect(applyPostProcessing(input, config)).toEqual([
      { end: 31, start: 1 },
      { end: 61, start: 31 },
      { end: 75, start: 61 },
    ]);
  });
});
