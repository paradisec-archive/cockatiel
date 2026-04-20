import { diffRegions } from '@/lib/region-sync/diff';
import type { DesiredState, RegionEvent, RegionSpec, RegionSync } from '@/lib/region-sync/types';

export interface FakeRegionSync extends RegionSync {
  disposed(): boolean;
  emit(event: RegionEvent): void;
  lastState(): DesiredState | null;
  regions(): ReadonlyMap<string, RegionSpec>;
  setClientXToTime(fn: (clientX: number) => number | null): void;
}

export const createFakeRegionSync = (): FakeRegionSync => {
  const dom = new Map<string, RegionSpec>();
  const listeners = new Set<(event: RegionEvent) => void>();
  let latest: DesiredState | null = null;
  let isDisposed = false;
  let clientXToTimeImpl: (clientX: number) => number | null = () => null;

  const sync = (state: DesiredState): void => {
    latest = state;
    const next = new Map(state.segments.map((s) => [s.id, s]));
    const ops = diffRegions(dom, next);
    for (const id of ops.removes) {
      dom.delete(id);
    }
    for (const spec of ops.adds) {
      dom.set(spec.id, spec);
    }
    for (const spec of ops.updates) {
      dom.set(spec.id, spec);
    }
  };

  const on = (listener: (event: RegionEvent) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const emit = (event: RegionEvent): void => {
    // Mirror the real adapter: a bounds-changed event means the DOM just moved,
    // so update our "DOM" map before notifying listeners. This lets snap-back
    // be asserted via regions() after a subsequent sync.
    if (event.type === 'bounds-changed') {
      const prev = dom.get(event.id);
      if (prev) {
        dom.set(event.id, { ...prev, end: event.end, start: event.start });
      }
    }
    for (const listener of listeners) {
      listener(event);
    }
  };

  return {
    clientXToTime: (clientX) => clientXToTimeImpl(clientX),
    dispose: () => {
      isDisposed = true;
      listeners.clear();
    },
    disposed: () => isDisposed,
    emit,
    lastState: () => latest,
    on,
    regions: () => dom,
    setClientXToTime: (fn) => {
      clientXToTimeImpl = fn;
    },
    sync,
  };
};
