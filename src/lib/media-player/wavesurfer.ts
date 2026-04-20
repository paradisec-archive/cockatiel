import WaveSurfer from 'wavesurfer.js';
import MinimapPlugin from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import { createEmitter } from './emitter';
import { createWavesurferRegionSync } from './region-sync/wavesurfer';
import type { DesiredRegions, MediaPlayer, MediaPlayerEvent, MediaPlayerState, Viewport } from './types';
import { computeZoomWindow } from './zoom-math';

export const createWavesurferMediaPlayer = (container: HTMLElement, colourFor: (speaker: number) => string): MediaPlayer => {
  const regions = RegionsPlugin.create();
  const zoomPlugin = ZoomPlugin.create({ exponentialZooming: true, iterations: 30, scale: 0.5 });
  const minimap = MinimapPlugin.create({
    height: 32,
    overlayColor: 'oklch(0.45 0.05 55 / 30%)',
    progressColor: 'oklch(0.45 0.08 55)',
    waveColor: 'oklch(0.65 0.04 55)',
  });

  const ws = WaveSurfer.create({
    container,
    cursorColor: 'oklch(0.45 0.18 25)',
    cursorWidth: 2,
    height: 160,
    normalize: true,
    plugins: [regions, zoomPlugin, minimap],
    progressColor: 'oklch(0.35 0.12 55)',
    waveColor: 'oklch(0.55 0.06 55)',
  });

  const events = createEmitter<MediaPlayerEvent>();
  const emit = events.emit;

  const state: MediaPlayerState = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isReady: false,
    minPxPerSec: 0,
    pxPerSec: 0,
    viewport: { pixelsPerSecond: 0, visibleEndTime: 0, visibleStartTime: 0 },
  };

  const updateMinPxPerSec = (): number => {
    const width = container.clientWidth;
    const duration = ws.getDuration();
    const next = width > 0 && duration > 0 ? width / duration : 0;
    state.minPxPerSec = next;
    return next;
  };

  // Viewport emission — rAF-coalesced so scroll/zoom drags don't re-render tiers per frame.
  let rafId: number | null = null;
  let pendingViewport: [number, number] | null = null;

  const publishViewport = (visibleStartTime: number, visibleEndTime: number): void => {
    const width = container.clientWidth;
    const pps = width / (visibleEndTime - visibleStartTime || 1);
    const viewport: Viewport = { pixelsPerSecond: pps, visibleEndTime, visibleStartTime };
    state.viewport = viewport;
    emit({ type: 'viewport', viewport });
  };

  const scheduleViewport = (visibleStartTime: number, visibleEndTime: number): void => {
    pendingViewport = [visibleStartTime, visibleEndTime];
    if (rafId !== null) {
      return;
    }
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!pendingViewport) {
        return;
      }
      const [s, e] = pendingViewport;
      pendingViewport = null;
      publishViewport(s, e);
    });
  };

  const emitFullViewport = (): void => {
    const duration = ws.getDuration();
    if (duration > 0) {
      publishViewport(0, duration);
    }
  };

  // Zoom echo suppression — swallow the `zoom` event wavesurfer fires as a direct
  // result of our own setZoom() call, so the slider doesn't round-trip back on itself.
  let programmaticZoomPending = false;

  // Region-sync calls into the regions plugin, which needs a decoded audio duration
  // to position regions. syncRegions before `ready` is buffered and flushed here.
  let pendingRegions: DesiredRegions | null = null;

  const unsubReady = ws.on('ready', (duration: number) => {
    state.duration = duration;
    state.isReady = true;
    updateMinPxPerSec();
    state.pxPerSec = state.minPxPerSec;
    emit({ duration, type: 'ready' });
    emitFullViewport();
    if (pendingRegions) {
      regionSync.sync(pendingRegions);
      pendingRegions = null;
    }
  });

  const unsubPlay = ws.on('play', () => {
    state.isPlaying = true;
    emit({ type: 'play' });
  });

  const unsubPause = ws.on('pause', () => {
    state.isPlaying = false;
    emit({ type: 'pause' });
  });

  const unsubTime = ws.on('timeupdate', (currentTime: number) => {
    state.currentTime = currentTime;
    emit({ currentTime, type: 'timeupdate' });
  });

  const unsubZoom = ws.on('zoom', (pxPerSec: number) => {
    state.pxPerSec = pxPerSec;
    if (programmaticZoomPending) {
      programmaticZoomPending = false;
      return;
    }
    emit({ minPxPerSec: state.minPxPerSec, pxPerSec, type: 'zoom' });
  });

  const unsubScroll = ws.on('scroll', (visibleStartTime: number, visibleEndTime: number) => {
    scheduleViewport(visibleStartTime, visibleEndTime);
  });

  // Container-width tracking — recompute minPxPerSec when the layout changes.
  const resizeObserver = new ResizeObserver(() => {
    if (state.isReady) {
      updateMinPxPerSec();
    }
  });
  resizeObserver.observe(container);

  const regionSync = createWavesurferRegionSync(ws, regions, container, colourFor);
  const unsubRegionSync = regionSync.on((event) => {
    switch (event.type) {
      case 'selected':
        emit({ id: event.id, type: 'region-selected' });
        break;
      case 'cleared':
        emit({ type: 'region-cleared' });
        break;
      case 'bounds-changed':
        emit({ end: event.end, id: event.id, start: event.start, type: 'region-bounds-changed' });
        break;
    }
  });

  // StrictMode loadBlob guard — don't reload the same file blob twice.
  let loadedFile: File | null = null;

  return {
    clientXToTime: (clientX) => regionSync.clientXToTime(clientX),
    dispose: () => {
      unsubReady();
      unsubPlay();
      unsubPause();
      unsubTime();
      unsubZoom();
      unsubScroll();
      unsubRegionSync();
      regionSync.dispose();
      resizeObserver.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      events.clear();
      ws.destroy();
    },
    getState: () => state,
    loadBlob: async (file) => {
      if (loadedFile === file) {
        return;
      }
      loadedFile = file;
      await ws.loadBlob(file);
    },
    on: events.on,
    pause: () => {
      ws.pause();
    },
    play: () => {
      void ws.play();
    },
    playPause: () => {
      void ws.playPause();
    },
    seek: (time) => {
      ws.setTime(time);
    },
    setZoom: (pxPerSec) => {
      programmaticZoomPending = true;
      ws.zoom(pxPerSec);
    },
    skip: (delta) => {
      ws.skip(delta);
    },
    syncRegions: (desired) => {
      if (!state.isReady) {
        pendingRegions = desired;
        return;
      }
      regionSync.sync(desired);
    },
    zoomToWindow: (start, end) => {
      const window = computeZoomWindow(container.clientWidth, ws.getDuration(), start, end);
      if (!window) {
        return;
      }
      programmaticZoomPending = true;
      ws.zoom(window.pxPerSec);
      ws.setScroll(window.scroll);
    },
  };
};
