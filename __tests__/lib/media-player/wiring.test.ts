import { describe, expect, it, vi } from 'vitest';
import type { MediaPlayerEvent } from '@/lib/media-player/types';
import { createFakeMediaPlayer } from './fake';

describe('media-player wiring (via fake)', () => {
  describe('transport', () => {
    it('seek mutates currentTime', () => {
      const player = createFakeMediaPlayer();
      player.seek(12);
      expect(player.getState().currentTime).toBe(12);
    });

    it('skip deltas the current time and clamps at zero', () => {
      const player = createFakeMediaPlayer();
      player.seek(5);
      player.skip(3);
      expect(player.getState().currentTime).toBe(8);
      player.skip(-100);
      expect(player.getState().currentTime).toBe(0);
    });
  });

  describe('zoom', () => {
    it('setZoom updates pxPerSec on state', () => {
      const player = createFakeMediaPlayer();
      player.setZoom(120);
      expect(player.getState().pxPerSec).toBe(120);
    });

    it('zoomToWindow computes a px-per-sec from container width + padding', () => {
      const player = createFakeMediaPlayer({ containerWidth: 500 });
      player.simulateReady(60);
      player.zoomToWindow(20, 30);
      // seg [20,30], span 10, padding 1, window span 12, px/sec = 500/12.
      expect(player.getState().pxPerSec).toBeCloseTo(500 / 12, 5);
    });

    it('zoomToWindow is a no-op when the span is zero', () => {
      const player = createFakeMediaPlayer({ containerWidth: 500 });
      player.simulateReady(60);
      player.setZoom(100);
      player.zoomToWindow(5, 5);
      expect(player.getState().pxPerSec).toBe(100);
    });

    it('setZoom notifies subscribers with a zoom event', () => {
      const player = createFakeMediaPlayer({ containerWidth: 500 });
      player.simulateReady(60);
      const listener = vi.fn<(event: MediaPlayerEvent) => void>();
      player.on(listener);
      player.setZoom(120);
      expect(listener).toHaveBeenCalledWith({ minPxPerSec: 500 / 60, pxPerSec: 120, type: 'zoom' });
    });

    it('zoomToWindow notifies subscribers with a zoom event', () => {
      const player = createFakeMediaPlayer({ containerWidth: 500 });
      player.simulateReady(60);
      const listener = vi.fn<(event: MediaPlayerEvent) => void>();
      player.on(listener);
      player.zoomToWindow(20, 30);
      expect(listener).toHaveBeenCalledWith({ minPxPerSec: 500 / 60, pxPerSec: 500 / 12, type: 'zoom' });
    });
  });

  describe('syncRegions', () => {
    it('adds, updates, and removes regions via diff', () => {
      const player = createFakeMediaPlayer();
      player.syncRegions({
        loopOnSelect: false,
        segments: [
          { end: 2, id: 'a', speaker: 0, start: 0 },
          { end: 5, id: 'b', speaker: 0, start: 3 },
        ],
        selectedId: null,
      });
      expect([...player.regions().keys()].sort()).toEqual(['a', 'b']);

      player.syncRegions({
        loopOnSelect: false,
        segments: [{ end: 3, id: 'a', speaker: 0, start: 0 }],
        selectedId: 'a',
      });
      expect([...player.regions().keys()]).toEqual(['a']);
      expect(player.regions().get('a')).toEqual({ end: 3, id: 'a', speaker: 0, start: 0 });
    });

    it('remembers the latest desired state', () => {
      const player = createFakeMediaPlayer();
      const desired = { loopOnSelect: true, segments: [], selectedId: null };
      player.syncRegions(desired);
      expect(player.lastDesiredRegions()).toEqual(desired);
    });
  });

  describe('clientXToTime', () => {
    it('delegates to the injected impl', () => {
      const player = createFakeMediaPlayer();
      player.setClientXToTime(() => 1.5);
      expect(player.clientXToTime(0)).toBe(1.5);
    });

    it('returns null by default', () => {
      const player = createFakeMediaPlayer();
      expect(player.clientXToTime(0)).toBeNull();
    });
  });

  describe('ready → derived state', () => {
    it('sets pxPerSec to the fit-to-window floor', () => {
      const player = createFakeMediaPlayer({ containerWidth: 600 });
      player.simulateReady(60);
      expect(player.getState().minPxPerSec).toBe(10);
      expect(player.getState().pxPerSec).toBe(10);
    });
  });
});
