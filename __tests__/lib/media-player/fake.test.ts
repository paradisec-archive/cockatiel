import { describe, expect, it, vi } from 'vitest';
import type { MediaPlayerEvent } from '@/lib/media-player/types';
import { createFakeMediaPlayer } from './fake';

describe('createFakeMediaPlayer', () => {
  it('fires ready with the simulated duration', () => {
    const player = createFakeMediaPlayer();
    const listener = vi.fn();
    player.on(listener);
    player.simulateReady(42);
    expect(listener).toHaveBeenCalledWith({ duration: 42, type: 'ready' } satisfies MediaPlayerEvent);
    expect(player.getState()).toMatchObject({ duration: 42, isReady: true });
  });

  it('toggles isPlaying on play/pause/playPause', () => {
    const player = createFakeMediaPlayer();
    player.play();
    expect(player.getState().isPlaying).toBe(true);
    player.pause();
    expect(player.getState().isPlaying).toBe(false);
    player.playPause();
    expect(player.getState().isPlaying).toBe(true);
    player.playPause();
    expect(player.getState().isPlaying).toBe(false);
  });

  it('emits timeupdate and mutates currentTime', () => {
    const player = createFakeMediaPlayer();
    const events: MediaPlayerEvent[] = [];
    player.on((e) => events.push(e));
    player.simulateTimeUpdate(5.5);
    expect(player.getState().currentTime).toBe(5.5);
    expect(events).toEqual([{ currentTime: 5.5, type: 'timeupdate' }]);
  });

  it('mirrors bounds-changed emit into the regions map', () => {
    const player = createFakeMediaPlayer();
    player.syncRegions({ loopOnSelect: false, segments: [{ end: 2, id: 'a', speaker: 0, start: 0 }], selectedId: null });
    player.simulateBoundsChanged('a', 0.5, 3);
    expect(player.regions().get('a')).toEqual({ end: 3, id: 'a', speaker: 0, start: 0.5 });
  });

  it('fans out events to multiple listeners and stops when unsubscribed', () => {
    const player = createFakeMediaPlayer();
    const a = vi.fn();
    const b = vi.fn();
    const offA = player.on(a);
    player.on(b);
    player.simulateReady(10);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    player.simulateReady(20);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('disposes and clears listeners', () => {
    const player = createFakeMediaPlayer();
    const listener = vi.fn();
    player.on(listener);
    expect(player.disposed()).toBe(false);
    player.dispose();
    expect(player.disposed()).toBe(true);
    player.simulateReady(10);
    expect(listener).not.toHaveBeenCalled();
  });
});
