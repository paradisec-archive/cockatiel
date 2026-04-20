import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWaveformSegments } from '@/hooks/useWaveformSegments';
import { useAppStore } from '@/lib/store';
import { createFakeRegionSync, type FakeRegionSync } from '../lib/region-sync/fake';

// Minimal stand-ins for the two wavesurfer objects — the fake factory ignores them.
const fakeWs = {} as never;
const fakeRegions = {} as never;

const mountHook = (fake: FakeRegionSync) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const containerRef = { current: container };
  return renderHook(() => useWaveformSegments(fakeWs, fakeRegions, containerRef, true, { factory: () => fake }));
};

const seedSegments = (specs: { id?: string; start: number; end: number; speaker?: number; value?: string }[]): string[] => {
  const ids: string[] = [];
  useAppStore.setState((state) => {
    const segments = specs.map((s) => {
      const id = s.id ?? crypto.randomUUID();
      ids.push(id);
      return { end: s.end, id, speaker: s.speaker ?? 0, start: s.start, value: s.value ?? '' };
    });
    return { ...state, segments };
  });
  return ids;
};

describe('useWaveformSegments', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    // Rebound validation needs a positive mediaDuration.
    useAppStore.setState({ mediaDuration: 100 });
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it('syncs the initial store state to the port on mount', () => {
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    const fake = createFakeRegionSync();
    mountHook(fake);

    expect(fake.lastState()).toMatchObject({ loopOnSelect: false, selectedId: null });
    expect([...fake.regions().keys()]).toEqual([idA]);
  });

  it('propagates additions and removals from the store', () => {
    const fake = createFakeRegionSync();
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        segments: [...state.segments, { end: 5, id: 'b', speaker: 0, start: 3, value: '' }],
      }));
    });
    expect([...fake.regions().keys()].sort()).toEqual(['b', idA].sort());

    act(() => {
      useAppStore.setState((state) => ({ ...state, segments: state.segments.filter((s) => s.id !== idA) }));
    });
    expect([...fake.regions().keys()]).toEqual(['b']);
  });

  it('does not re-sync when only segment text changes', () => {
    const fake = createFakeRegionSync();
    const [idA] = seedSegments([{ end: 2, start: 0, value: '' }]);
    mountHook(fake);

    const firstSnapshot = fake.lastState();

    act(() => {
      useAppStore.getState().updateSegmentText(idA, 'hello');
    });

    // New snapshot will still be applied (because segments reference changes),
    // but the diff produces no ops — assert the fake's regions haven't mutated.
    expect(fake.regions().get(idA)).toEqual({ end: 2, id: idA, speaker: 0, start: 0 });
    expect(fake.lastState()).not.toBe(firstSnapshot); // sync called again…
    expect(fake.lastState()?.segments[0]).toEqual({ end: 2, id: idA, speaker: 0, start: 0 }); // …with equivalent segment data
  });

  it('translates selected events into selectSegment', () => {
    const fake = createFakeRegionSync();
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);

    act(() => {
      fake.emit({ id: idA, type: 'selected' });
    });
    expect(useAppStore.getState().selectedSegmentId).toBe(idA);
  });

  it('translates cleared events into selectSegment(null)', () => {
    const fake = createFakeRegionSync();
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);
    act(() => {
      useAppStore.getState().selectSegment(idA);
    });
    expect(useAppStore.getState().selectedSegmentId).toBe(idA);

    act(() => {
      fake.emit({ type: 'cleared' });
    });
    expect(useAppStore.getState().selectedSegmentId).toBeNull();
  });

  it('translates bounds-changed events into updateSegmentBounds', () => {
    const fake = createFakeRegionSync();
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);

    act(() => {
      fake.emit({ end: 3, id: idA, start: 0.5, type: 'bounds-changed' });
    });
    const updated = useAppStore.getState().segments[0];
    expect(updated.start).toBe(0.5);
    expect(updated.end).toBe(3);
  });

  it('snaps a rejected drag back to the canonical bounds', () => {
    const fake = createFakeRegionSync();
    const [idA] = seedSegments([
      { end: 2, start: 0 },
      { end: 5, start: 3 },
    ]);
    mountHook(fake);

    // Drag the first region past its right neighbour → overlap → store rejects.
    act(() => {
      fake.emit({ end: 4, id: idA, start: 0, type: 'bounds-changed' });
    });

    // Store unchanged
    const unchanged = useAppStore.getState().segments.find((s) => s.id === idA);
    expect(unchanged?.end).toBe(2);
    // Fake DOM snapped back
    expect(fake.regions().get(idA)).toEqual({ end: 2, id: idA, speaker: 0, start: 0 });
  });

  it('disposes the port on unmount', () => {
    const fake = createFakeRegionSync();
    seedSegments([{ end: 2, start: 0 }]);
    const { unmount } = mountHook(fake);
    expect(fake.disposed()).toBe(false);
    unmount();
    expect(fake.disposed()).toBe(true);
  });

  it('getClickContext combines port.clientXToTime with findAtTime', () => {
    const fake = createFakeRegionSync();
    fake.setClientXToTime(() => 1.0); // always return time=1.0
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    const { result } = mountHook(fake);

    const ctx = result.current.getClickContext({ clientX: 0 } as React.MouseEvent);
    expect(ctx).toEqual({ segmentId: idA, time: 1.0 });
  });

  it('getClickContext returns null when clientXToTime does', () => {
    const fake = createFakeRegionSync();
    fake.setClientXToTime(() => null);
    seedSegments([{ end: 2, start: 0 }]);
    const { result } = mountHook(fake);
    expect(result.current.getClickContext({ clientX: 0 } as React.MouseEvent)).toBeNull();
  });

  it('reflects loopOnSelect changes in the port without requiring a re-click', () => {
    const fake = createFakeRegionSync();
    seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);

    expect(fake.lastState()?.loopOnSelect).toBe(false);
    act(() => {
      useAppStore.getState().setLoopOnSelect(true);
    });
    expect(fake.lastState()?.loopOnSelect).toBe(true);
  });
});
