import { createEmitter } from '@/lib/media-player/emitter';
import type { DesiredRegions, RegionEvent, RegionSpec, RegionSync } from '@/lib/media-player/region-sync/types';

interface FakeRegionSync extends RegionSync {
  disposed(): boolean;
  emit(event: RegionEvent): void;
  lastState(): DesiredRegions | null;
  regions(): ReadonlyMap<string, RegionSpec>;
  setClientXToTime(fn: (clientX: number) => number | null): void;
}

export const createFakeRegionSync = (): FakeRegionSync => {
  const dom = new Map<string, RegionSpec>();
  const events = createEmitter<RegionEvent>();
  let latest: DesiredRegions | null = null;
  let isDisposed = false;
  let clientXToTimeImpl: (clientX: number) => number | null = () => null;

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
    events.emit(event);
  };

  return {
    clientXToTime: (clientX) => clientXToTimeImpl(clientX),
    dispose: () => {
      isDisposed = true;
      events.clear();
    },
    disposed: () => isDisposed,
    emit,
    lastState: () => latest,
    on: events.on,
    regions: () => dom,
    setClientXToTime: (fn) => {
      clientXToTimeImpl = fn;
    },
    sync: (state) => {
      latest = state;
      dom.clear();
      for (const spec of state.segments) {
        dom.set(spec.id, spec);
      }
    },
  };
};
