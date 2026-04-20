import { describe, expect, it } from 'vitest';
import { type Annotation, MIN_DURATION, rejectionMessage, type SegmentCtx, SegmentInspect, SegmentOps, type SegmentState, SPLIT_GAP } from '@/lib/segment-ops';

const seg = (id: string, start: number, end: number, speaker = 0, value = ''): Annotation => ({ end, id, speaker, start, value });

const makeState = (segments: Annotation[], selectedSegmentId: string | null = null): SegmentState => ({ segments, selectedSegmentId });

const makeCtx = (overrides: Partial<SegmentCtx> = {}): SegmentCtx => {
  let counter = 0;
  return {
    defaultSpeaker: 0,
    mediaDuration: 100,
    newId: () => `new-${++counter}`,
    speakerCount: 3,
    ...overrides,
  };
};

describe('SegmentOps.split', () => {
  it('splits a segment at a valid time, leaving SPLIT_GAP silence', () => {
    const state = makeState([seg('a', 0, 10, 1, 'hello')]);
    const next = SegmentOps.split(state, 'a', 5, makeCtx());

    expect(next.segments).toHaveLength(2);
    expect(next.segments[0]).toEqual({ id: 'a', start: 0, end: 5 - SPLIT_GAP, speaker: 1, value: 'hello' });
    expect(next.segments[1]).toEqual({ id: 'new-1', start: 5 + SPLIT_GAP, end: 10, speaker: 1, value: '' });
  });

  it('selects the right-hand segment after split', () => {
    const state = makeState([seg('a', 0, 10)], 'a');
    const next = SegmentOps.split(state, 'a', 5, makeCtx());
    expect(next.selectedSegmentId).toBe('new-1');
  });

  it('rejects split-too-close-to-edge at the start edge', () => {
    const state = makeState([seg('a', 0, 10)]);
    const next = SegmentOps.split(state, 'a', SPLIT_GAP, makeCtx());
    expect(next).toBe(state);
    expect(SegmentInspect.split(state, 'a', SPLIT_GAP)).toBe('split-too-close-to-edge');
  });

  it('rejects split-too-close-to-edge at the end edge', () => {
    const state = makeState([seg('a', 0, 10)]);
    const next = SegmentOps.split(state, 'a', 10 - SPLIT_GAP, makeCtx());
    expect(next).toBe(state);
    expect(SegmentInspect.split(state, 'a', 10 - SPLIT_GAP)).toBe('split-too-close-to-edge');
  });

  it('rejects not-found on unknown id', () => {
    const state = makeState([seg('a', 0, 10)]);
    const next = SegmentOps.split(state, 'missing', 5, makeCtx());
    expect(next).toBe(state);
    expect(SegmentInspect.split(state, 'missing', 5)).toBe('not-found');
  });
});

describe('SegmentOps.mergeNext', () => {
  it('merges with the next segment in sorted order', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 4, 7, 2, 'hi')]);
    const next = SegmentOps.mergeNext(state, 'a');
    expect(next.segments).toHaveLength(1);
    expect(next.segments[0]).toEqual({ id: 'a', start: 0, end: 7, speaker: 0, value: '' });
    expect(next.selectedSegmentId).toBe('a');
  });

  it('rejects no-neighbour-next when called on the last segment', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 4, 7)]);
    const next = SegmentOps.mergeNext(state, 'b');
    expect(next).toBe(state);
    expect(SegmentInspect.mergeNext(state, 'b')).toBe('no-neighbour-next');
  });

  it('rejects not-found on unknown id', () => {
    const state = makeState([seg('a', 0, 3)]);
    expect(SegmentOps.mergeNext(state, 'missing')).toBe(state);
    expect(SegmentInspect.mergeNext(state, 'missing')).toBe('not-found');
  });
});

describe('SegmentOps.mergePrev', () => {
  it('merges with the previous segment, preserving its id and speaker', () => {
    const state = makeState([seg('a', 0, 3, 1), seg('b', 4, 7, 2)]);
    const next = SegmentOps.mergePrev(state, 'b');
    expect(next.segments).toHaveLength(1);
    expect(next.segments[0]).toEqual({ id: 'a', start: 0, end: 7, speaker: 1, value: '' });
    expect(next.selectedSegmentId).toBe('a');
  });

  it('rejects no-neighbour-prev when called on the first segment', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 4, 7)]);
    expect(SegmentOps.mergePrev(state, 'a')).toBe(state);
    expect(SegmentInspect.mergePrev(state, 'a')).toBe('no-neighbour-prev');
  });
});

describe('SegmentOps.remove', () => {
  it('removes a segment', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 4, 7)]);
    const next = SegmentOps.remove(state, 'a');
    expect(next.segments.map((s) => s.id)).toEqual(['b']);
  });

  it('clears selection iff the removed segment was selected', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 4, 7)], 'a');
    const next = SegmentOps.remove(state, 'a');
    expect(next.selectedSegmentId).toBeNull();
  });

  it('preserves selection when a different segment is removed', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 4, 7)], 'b');
    const next = SegmentOps.remove(state, 'a');
    expect(next.selectedSegmentId).toBe('b');
  });

  it('rejects not-found on unknown id', () => {
    const state = makeState([seg('a', 0, 3)]);
    expect(SegmentOps.remove(state, 'missing')).toBe(state);
    expect(SegmentInspect.remove(state, 'missing')).toBe('not-found');
  });
});

describe('SegmentOps.create', () => {
  it('adds a new segment with injected id and selects it', () => {
    const state = makeState([]);
    const next = SegmentOps.create(state, 1, 2, 0, makeCtx());
    expect(next.segments).toEqual([{ id: 'new-1', start: 1, end: 2, speaker: 0, value: '' }]);
    expect(next.selectedSegmentId).toBe('new-1');
  });

  it('rejects out-of-bounds when start is negative', () => {
    const state = makeState([]);
    const ctx = makeCtx();
    expect(SegmentOps.create(state, -1, 2, 0, ctx)).toBe(state);
    expect(SegmentInspect.create(state, -1, 2, 0, ctx)).toBe('out-of-bounds');
  });

  it('rejects out-of-bounds when end exceeds mediaDuration', () => {
    const state = makeState([]);
    const ctx = makeCtx({ mediaDuration: 10 });
    expect(SegmentOps.create(state, 5, 11, 0, ctx)).toBe(state);
    expect(SegmentInspect.create(state, 5, 11, 0, ctx)).toBe('out-of-bounds');
  });

  it('rejects below-min-duration', () => {
    const state = makeState([]);
    const ctx = makeCtx();
    const tiny = MIN_DURATION / 2;
    expect(SegmentOps.create(state, 1, 1 + tiny, 0, ctx)).toBe(state);
    expect(SegmentInspect.create(state, 1, 1 + tiny, 0, ctx)).toBe('below-min-duration');
  });

  it('rejects would-overlap', () => {
    const state = makeState([seg('a', 5, 10)]);
    const ctx = makeCtx();
    expect(SegmentOps.create(state, 7, 12, 0, ctx)).toBe(state);
    expect(SegmentInspect.create(state, 7, 12, 0, ctx)).toBe('would-overlap');
  });

  it('rejects invalid-speaker', () => {
    const state = makeState([]);
    const ctx = makeCtx({ speakerCount: 2 });
    expect(SegmentOps.create(state, 1, 2, 5, ctx)).toBe(state);
    expect(SegmentInspect.create(state, 1, 2, 5, ctx)).toBe('invalid-speaker');
  });
});

describe('SegmentOps.createAt', () => {
  it('creates a 1-second segment centered on time when the gap allows it', () => {
    const state = makeState([]);
    const next = SegmentOps.createAt(state, 10, makeCtx({ defaultSpeaker: 0 }));
    expect(next.segments).toHaveLength(1);
    expect(next.segments[0].start).toBeCloseTo(9.5);
    expect(next.segments[0].end).toBeCloseTo(10.5);
  });

  it('inherits speaker from the nearest existing segment', () => {
    const state = makeState([seg('a', 0, 2, 2)]);
    const next = SegmentOps.createAt(state, 10, makeCtx({ defaultSpeaker: 0 }));
    expect(next.segments[1].speaker).toBe(2);
  });

  it('rejects no-room when time falls inside an existing segment', () => {
    const state = makeState([seg('a', 0, 10)]);
    const ctx = makeCtx();
    expect(SegmentOps.createAt(state, 5, ctx)).toBe(state);
    expect(SegmentInspect.createAt(state, 5, ctx)).toBe('no-room');
  });

  it('rejects no-room when neighbouring segments leave less than MIN_DURATION', () => {
    const state = makeState([seg('a', 0, 10), seg('b', 10.02, 20)]);
    const ctx = makeCtx();
    expect(SegmentOps.createAt(state, 10.01, ctx)).toBe(state);
    expect(SegmentInspect.createAt(state, 10.01, ctx)).toBe('no-room');
  });
});

describe('SegmentOps.rebound', () => {
  it('updates segment bounds on valid input and preserves selection', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 5, 8, 1, 'hi')], 'b');
    const next = SegmentOps.rebound(state, 'b', 4, 9, makeCtx());
    const updated = next.segments.find((s) => s.id === 'b');
    expect(updated).toEqual({ id: 'b', start: 4, end: 9, speaker: 1, value: 'hi' });
    expect(next.selectedSegmentId).toBe('b');
  });

  it('rejects out-of-bounds when end exceeds mediaDuration', () => {
    const state = makeState([seg('a', 0, 10)]);
    const ctx = makeCtx({ mediaDuration: 10 });
    expect(SegmentOps.rebound(state, 'a', 0, 11, ctx)).toBe(state);
    expect(SegmentInspect.rebound(state, 'a', 0, 11, ctx)).toBe('out-of-bounds');
  });

  it('rejects would-overlap when dragged past a neighbour', () => {
    const state = makeState([seg('a', 0, 3), seg('b', 5, 8)]);
    const ctx = makeCtx();
    expect(SegmentOps.rebound(state, 'a', 0, 6, ctx)).toBe(state);
    expect(SegmentInspect.rebound(state, 'a', 0, 6, ctx)).toBe('would-overlap');
  });

  it('rejects below-min-duration', () => {
    const state = makeState([seg('a', 0, 10)]);
    const ctx = makeCtx();
    expect(SegmentOps.rebound(state, 'a', 5, 5.01, ctx)).toBe(state);
    expect(SegmentInspect.rebound(state, 'a', 5, 5.01, ctx)).toBe('below-min-duration');
  });

  it('rejects not-found on unknown id', () => {
    const state = makeState([seg('a', 0, 10)]);
    const ctx = makeCtx();
    expect(SegmentOps.rebound(state, 'missing', 1, 2, ctx)).toBe(state);
    expect(SegmentInspect.rebound(state, 'missing', 1, 2, ctx)).toBe('not-found');
  });
});

describe('SegmentOps.assignSpeaker', () => {
  it('updates the speaker on a valid segment', () => {
    const state = makeState([seg('a', 0, 3, 0), seg('b', 4, 7, 0)]);
    const next = SegmentOps.assignSpeaker(state, 'a', 2, makeCtx({ speakerCount: 3 }));
    expect(next.segments.find((s) => s.id === 'a')?.speaker).toBe(2);
    expect(next.segments.find((s) => s.id === 'b')?.speaker).toBe(0);
  });

  it('rejects invalid-speaker', () => {
    const state = makeState([seg('a', 0, 3)]);
    const ctx = makeCtx({ speakerCount: 2 });
    expect(SegmentOps.assignSpeaker(state, 'a', 5, ctx)).toBe(state);
    expect(SegmentInspect.assignSpeaker(state, 'a', 5, ctx)).toBe('invalid-speaker');
  });
});

describe('SegmentOps.assignAll', () => {
  it('assigns every segment to the given speaker', () => {
    const state = makeState([seg('a', 0, 3, 0), seg('b', 4, 7, 1)]);
    const next = SegmentOps.assignAll(state, 2, makeCtx({ speakerCount: 3 }));
    expect(next.segments.every((s) => s.speaker === 2)).toBe(true);
  });

  it('rejects invalid-speaker', () => {
    const state = makeState([seg('a', 0, 3)]);
    const ctx = makeCtx({ speakerCount: 2 });
    expect(SegmentOps.assignAll(state, 5, ctx)).toBe(state);
    expect(SegmentInspect.assignAll(state, 5, ctx)).toBe('invalid-speaker');
  });
});

describe('SegmentOps.reconcileSpeakers', () => {
  it('reassigns orphaned speakers to the last valid index', () => {
    const state = makeState([seg('a', 0, 3, 4), seg('b', 4, 7, 1)]);
    const next = SegmentOps.reconcileSpeakers(state, 2);
    expect(next.segments.find((s) => s.id === 'a')?.speaker).toBe(1);
    expect(next.segments.find((s) => s.id === 'b')?.speaker).toBe(1);
  });

  it('preserves selection', () => {
    const state = makeState([seg('a', 0, 3, 4)], 'a');
    const next = SegmentOps.reconcileSpeakers(state, 2);
    expect(next.selectedSegmentId).toBe('a');
  });

  it('returns identity when no segment needs reassignment', () => {
    const state = makeState([seg('a', 0, 3, 0), seg('b', 4, 7, 1)]);
    expect(SegmentOps.reconcileSpeakers(state, 3)).toBe(state);
  });
});

describe('SegmentInspect lookups', () => {
  it('sortedByStart returns a sorted copy without mutating', () => {
    const segments = [seg('b', 5, 8), seg('a', 0, 3)];
    const sorted = SegmentInspect.sortedByStart(segments);
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b']);
    expect(segments.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('findAtTime finds the segment whose interval contains the time', () => {
    const segments = [seg('a', 0, 3), seg('b', 5, 8)];
    expect(SegmentInspect.findAtTime(segments, 1)?.id).toBe('a');
    expect(SegmentInspect.findAtTime(segments, 4)).toBeUndefined();
    expect(SegmentInspect.findAtTime(segments, 6)?.id).toBe('b');
  });

  it('nearestSpeaker returns the speaker of the closest segment centre', () => {
    const segments = [seg('a', 0, 2, 3), seg('b', 10, 12, 7)];
    expect(SegmentInspect.nearestSpeaker(segments, 1, 0)).toBe(3);
    expect(SegmentInspect.nearestSpeaker(segments, 11, 0)).toBe(7);
    expect(SegmentInspect.nearestSpeaker([], 5, 42)).toBe(42);
  });
});

describe('rejectionMessage', () => {
  it('returns a non-empty message for every Rejection code', () => {
    const codes = [
      'not-found',
      'split-too-close-to-edge',
      'no-neighbour-next',
      'no-neighbour-prev',
      'no-room',
      'below-min-duration',
      'out-of-bounds',
      'would-overlap',
      'invalid-speaker',
    ] as const;
    for (const code of codes) {
      expect(rejectionMessage(code)).toMatch(/\S/);
    }
  });
});
