import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useMediaPlayerBridge } from '@/hooks/useMediaPlayerBridge';
import { useAppStore } from '@/lib/store';
import { createFakeMediaPlayer, type FakeMediaPlayer } from '../lib/media-player/fake';

const mountHook = (fake: FakeMediaPlayer) => {
  return renderHook(() => useMediaPlayerBridge(fake));
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

describe('useMediaPlayerBridge', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    // Rebound validation needs a positive mediaDuration.
    useAppStore.setState({ mediaDuration: 100 });
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it('syncs the initial store state to the player on mount', () => {
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    const fake = createFakeMediaPlayer();
    mountHook(fake);

    expect(fake.lastDesiredRegions()).toMatchObject({ loopOnSelect: false, selectedId: null });
    expect([...fake.regions().keys()]).toEqual([idA]);
  });

  it('propagates additions and removals from the store', () => {
    const fake = createFakeMediaPlayer();
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

  it('does not re-sync region bounds when only segment text changes', () => {
    const fake = createFakeMediaPlayer();
    const [idA] = seedSegments([{ end: 2, start: 0, value: '' }]);
    mountHook(fake);

    const firstSnapshot = fake.lastDesiredRegions();

    act(() => {
      useAppStore.getState().updateSegmentText(idA, 'hello');
    });

    expect(fake.regions().get(idA)).toEqual({ end: 2, id: idA, speaker: 0, start: 0 });
    expect(fake.lastDesiredRegions()).not.toBe(firstSnapshot);
    expect(fake.lastDesiredRegions()?.segments[0]).toEqual({ end: 2, id: idA, speaker: 0, start: 0 });
  });

  it('translates region-selected events into selectSegment', () => {
    const fake = createFakeMediaPlayer();
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);

    act(() => {
      fake.emit({ id: idA, type: 'region-selected' });
    });
    expect(useAppStore.getState().selectedSegmentId).toBe(idA);
  });

  it('translates region-cleared events into selectSegment(null)', () => {
    const fake = createFakeMediaPlayer();
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);
    act(() => {
      useAppStore.getState().selectSegment(idA);
    });
    expect(useAppStore.getState().selectedSegmentId).toBe(idA);

    act(() => {
      fake.emit({ type: 'region-cleared' });
    });
    expect(useAppStore.getState().selectedSegmentId).toBeNull();
  });

  it('translates region-bounds-changed events into updateSegmentBounds', () => {
    const fake = createFakeMediaPlayer();
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);

    act(() => {
      fake.emit({ end: 3, id: idA, start: 0.5, type: 'region-bounds-changed' });
    });
    const updated = useAppStore.getState().segments[0];
    expect(updated.start).toBe(0.5);
    expect(updated.end).toBe(3);
  });

  it('snaps a rejected drag back to the canonical bounds', () => {
    const fake = createFakeMediaPlayer();
    const [idA] = seedSegments([
      { end: 2, start: 0 },
      { end: 5, start: 3 },
    ]);
    mountHook(fake);

    act(() => {
      fake.emit({ end: 4, id: idA, start: 0, type: 'region-bounds-changed' });
    });

    const unchanged = useAppStore.getState().segments.find((s) => s.id === idA);
    expect(unchanged?.end).toBe(2);
    expect(fake.regions().get(idA)).toEqual({ end: 2, id: idA, speaker: 0, start: 0 });
  });

  it('getClickContext combines player.clientXToTime with findAtTime', () => {
    const fake = createFakeMediaPlayer();
    fake.setClientXToTime(() => 1.0);
    const [idA] = seedSegments([{ end: 2, start: 0 }]);
    const { result } = mountHook(fake);

    const ctx = result.current.getClickContext({ clientX: 0 } as React.MouseEvent);
    expect(ctx).toEqual({ segmentId: idA, time: 1.0 });
  });

  it('getClickContext returns null when clientXToTime does', () => {
    const fake = createFakeMediaPlayer();
    fake.setClientXToTime(() => null);
    seedSegments([{ end: 2, start: 0 }]);
    const { result } = mountHook(fake);
    expect(result.current.getClickContext({ clientX: 0 } as React.MouseEvent)).toBeNull();
  });

  it('reflects loopOnSelect changes in the player without requiring a re-click', () => {
    const fake = createFakeMediaPlayer();
    seedSegments([{ end: 2, start: 0 }]);
    mountHook(fake);

    expect(fake.lastDesiredRegions()?.loopOnSelect).toBe(false);
    act(() => {
      useAppStore.getState().setLoopOnSelect(true);
    });
    expect(fake.lastDesiredRegions()?.loopOnSelect).toBe(true);
  });
});
