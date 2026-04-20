import { describe, expect, it, vi } from 'vitest';
import type { RegionSpec } from '@/lib/media-player/region-sync/types';
import { createFakeRegionSync } from './fake';

const r = (id: string, start: number, end: number, speaker = 0): RegionSpec => ({ end, id, speaker, start });

describe('createFakeRegionSync', () => {
  it('records sync state via lastState()', () => {
    const fake = createFakeRegionSync();
    fake.sync({ loopOnSelect: false, segments: [r('a', 0, 1)], selectedId: null });
    expect(fake.lastState()).toEqual({ loopOnSelect: false, segments: [r('a', 0, 1)], selectedId: null });
  });

  it('reflects sync operations in regions()', () => {
    const fake = createFakeRegionSync();
    fake.sync({ loopOnSelect: false, segments: [r('a', 0, 1), r('b', 1, 2)], selectedId: null });
    expect([...fake.regions().keys()].sort()).toEqual(['a', 'b']);

    fake.sync({ loopOnSelect: false, segments: [r('a', 0, 1.5)], selectedId: null });
    expect([...fake.regions().keys()]).toEqual(['a']);
    expect(fake.regions().get('a')).toEqual(r('a', 0, 1.5));
  });

  it('delivers emitted events to subscribers', () => {
    const fake = createFakeRegionSync();
    const listener = vi.fn();
    const unsub = fake.on(listener);
    fake.emit({ id: 'a', type: 'selected' });
    expect(listener).toHaveBeenCalledWith({ id: 'a', type: 'selected' });
    unsub();
    fake.emit({ type: 'cleared' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('disposes listeners and flags disposed()', () => {
    const fake = createFakeRegionSync();
    const listener = vi.fn();
    fake.on(listener);
    fake.dispose();
    fake.emit({ type: 'cleared' });
    expect(listener).not.toHaveBeenCalled();
    expect(fake.disposed()).toBe(true);
  });

  it('routes clientXToTime through the injected implementation', () => {
    const fake = createFakeRegionSync();
    fake.setClientXToTime((x) => x * 0.01);
    expect(fake.clientXToTime(250)).toBe(2.5);
  });
});
