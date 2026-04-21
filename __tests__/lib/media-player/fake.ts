import { createEmitter } from '@/lib/media-player/emitter';
import type { DesiredRegions, MediaPlayer, MediaPlayerEvent, MediaPlayerState, RegionSpec } from '@/lib/media-player/types';
import { computeZoomWindow } from '@/lib/media-player/zoom-math';

export interface FakeMediaPlayer extends MediaPlayer {
  disposed(): boolean;
  emit(event: MediaPlayerEvent): void;
  lastDesiredRegions(): DesiredRegions | null;
  regions(): ReadonlyMap<string, RegionSpec>;
  setClientXToTime(fn: (clientX: number) => number | null): void;
  simulateBoundsChanged(id: string, start: number, end: number): void;
  simulateReady(duration: number): void;
  simulateTimeUpdate(time: number): void;
}

interface FakeMediaPlayerOptions {
  containerWidth?: number;
}

export const createFakeMediaPlayer = (options: FakeMediaPlayerOptions = {}): FakeMediaPlayer => {
  const events = createEmitter<MediaPlayerEvent>();
  const dom = new Map<string, RegionSpec>();
  let latest: DesiredRegions | null = null;
  let isDisposed = false;
  let clientXToTimeImpl: (clientX: number) => number | null = () => null;
  const containerWidth = options.containerWidth ?? 1000;

  const state: MediaPlayerState = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isReady: false,
    minPxPerSec: 0,
    pxPerSec: 0,
    viewport: { pixelsPerSecond: 0, visibleEndTime: 0, visibleStartTime: 0 },
  };

  const emit = (event: MediaPlayerEvent): void => {
    // Mirror the real adapter: a bounds-changed event means the DOM just moved,
    // so update our "DOM" map before notifying listeners. This lets snap-back
    // be asserted via regions() after a subsequent syncRegions.
    if (event.type === 'region-bounds-changed') {
      const prev = dom.get(event.id);
      if (prev) {
        dom.set(event.id, { ...prev, end: event.end, start: event.start });
      }
    }
    events.emit(event);
  };

  const recomputeMinPxPerSec = (): void => {
    state.minPxPerSec = containerWidth > 0 && state.duration > 0 ? containerWidth / state.duration : 0;
  };

  return {
    clientXToTime: (clientX) => clientXToTimeImpl(clientX),
    dispose: () => {
      isDisposed = true;
      events.clear();
    },
    disposed: () => isDisposed,
    emit,
    getState: () => state,
    lastDesiredRegions: () => latest,
    loadBlob: async () => {
      // No-op: tests drive `simulateReady` directly.
    },
    on: events.on,
    pause: () => {
      state.isPlaying = false;
      emit({ type: 'pause' });
    },
    play: () => {
      state.isPlaying = true;
      emit({ type: 'play' });
    },
    playPause: () => {
      state.isPlaying = !state.isPlaying;
      emit({ type: state.isPlaying ? 'play' : 'pause' });
    },
    regions: () => dom,
    seek: (time) => {
      state.currentTime = time;
    },
    setClientXToTime: (fn) => {
      clientXToTimeImpl = fn;
    },
    setZoom: (pxPerSec) => {
      state.pxPerSec = pxPerSec;
      emit({ minPxPerSec: state.minPxPerSec, pxPerSec, type: 'zoom' });
    },
    simulateBoundsChanged: (id, start, end) => {
      emit({ end, id, start, type: 'region-bounds-changed' });
    },
    simulateReady: (duration) => {
      state.duration = duration;
      state.isReady = true;
      recomputeMinPxPerSec();
      state.pxPerSec = state.minPxPerSec;
      emit({ duration, type: 'ready' });
    },
    simulateTimeUpdate: (time) => {
      state.currentTime = time;
      emit({ currentTime: time, type: 'timeupdate' });
    },
    skip: (delta) => {
      state.currentTime = Math.max(0, state.currentTime + delta);
    },
    syncRegions: (desired) => {
      latest = desired;
      dom.clear();
      for (const spec of desired.segments) {
        dom.set(spec.id, spec);
      }
    },
    zoomToWindow: (start, end) => {
      const window = computeZoomWindow(containerWidth, state.duration, start, end);
      if (window) {
        state.pxPerSec = window.pxPerSec;
        emit({ minPxPerSec: state.minPxPerSec, pxPerSec: window.pxPerSec, type: 'zoom' });
      }
    },
  };
};
