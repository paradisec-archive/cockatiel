import { describe, expect, it } from 'vitest';
import { diffRegions } from '@/lib/region-sync/diff';
import type { RegionSpec } from '@/lib/region-sync/types';

const r = (id: string, start: number, end: number, speaker = 0): RegionSpec => ({ end, id, speaker, start });

const asMap = (specs: RegionSpec[]): Map<string, RegionSpec> => new Map(specs.map((s) => [s.id, s]));

describe('diffRegions', () => {
  it('returns empty ops when prev and next are equal', () => {
    const prev = asMap([r('a', 0, 1), r('b', 1, 2)]);
    const next = asMap([r('a', 0, 1), r('b', 1, 2)]);
    expect(diffRegions(prev, next)).toEqual({ adds: [], removes: [], updates: [] });
  });

  it('records adds for ids in next but not prev', () => {
    const prev = asMap([r('a', 0, 1)]);
    const next = asMap([r('a', 0, 1), r('b', 1, 2)]);
    const ops = diffRegions(prev, next);
    expect(ops.adds).toEqual([r('b', 1, 2)]);
    expect(ops.removes).toEqual([]);
    expect(ops.updates).toEqual([]);
  });

  it('records removes for ids in prev but not next', () => {
    const prev = asMap([r('a', 0, 1), r('b', 1, 2)]);
    const next = asMap([r('a', 0, 1)]);
    const ops = diffRegions(prev, next);
    expect(ops.adds).toEqual([]);
    expect(ops.removes).toEqual(['b']);
    expect(ops.updates).toEqual([]);
  });

  it('records updates when start or end changes', () => {
    const prev = asMap([r('a', 0, 1)]);
    const next = asMap([r('a', 0, 1.5)]);
    expect(diffRegions(prev, next).updates).toEqual([r('a', 0, 1.5)]);
  });

  it('records updates when speaker changes (colour must refresh)', () => {
    const prev = asMap([r('a', 0, 1, 0)]);
    const next = asMap([r('a', 0, 1, 1)]);
    expect(diffRegions(prev, next).updates).toEqual([r('a', 0, 1, 1)]);
  });

  it('combines adds, removes, and updates in one pass', () => {
    const prev = asMap([r('a', 0, 1), r('b', 1, 2), r('c', 2, 3)]);
    const next = asMap([r('a', 0, 1), r('b', 1, 2.5), r('d', 3, 4)]);
    const ops = diffRegions(prev, next);
    expect(ops.adds).toEqual([r('d', 3, 4)]);
    expect(ops.removes).toEqual(['c']);
    expect(ops.updates).toEqual([r('b', 1, 2.5)]);
  });
});
