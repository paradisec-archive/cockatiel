import { describe, expect, it } from 'vitest';
import { IDLE, type LoopState, nextLoopState } from '@/lib/region-sync/loop-state';

const looping = (regionId: string): LoopState => ({ kind: 'looping', regionId });

describe('nextLoopState', () => {
  describe('region-clicked', () => {
    it('transitions idle → looping and emits select', () => {
      const t = nextLoopState(IDLE, { regionId: 'a', type: 'region-clicked' }, false);
      expect(t.state).toEqual(looping('a'));
      expect(t.action).toEqual({ regionId: 'a', type: 'select' });
    });

    it('transitions between regions cleanly (back-to-back clicks)', () => {
      const first = nextLoopState(IDLE, { regionId: 'a', type: 'region-clicked' }, true);
      const second = nextLoopState(first.state, { regionId: 'b', type: 'region-clicked' }, true);
      expect(second.state).toEqual(looping('b'));
      expect(second.action).toEqual({ regionId: 'b', type: 'select' });
    });
  });

  describe('region-out', () => {
    it('replays the looping region when loopOnSelect is true', () => {
      const t = nextLoopState(looping('a'), { regionId: 'a', type: 'region-out' }, true);
      expect(t.state).toEqual(looping('a'));
      expect(t.action).toEqual({ regionId: 'a', type: 'replay' });
    });

    it('returns to idle when loopOnSelect is false', () => {
      const t = nextLoopState(looping('a'), { regionId: 'a', type: 'region-out' }, false);
      expect(t.state).toEqual(IDLE);
      expect(t.action).toBeNull();
    });

    it('ignores out events for a non-matching region', () => {
      const t = nextLoopState(looping('a'), { regionId: 'b', type: 'region-out' }, true);
      expect(t.state).toEqual(looping('a'));
      expect(t.action).toBeNull();
    });

    it('ignores out events when idle', () => {
      const t = nextLoopState(IDLE, { regionId: 'a', type: 'region-out' }, true);
      expect(t.state).toEqual(IDLE);
      expect(t.action).toBeNull();
    });

    it('picks up a mid-playback loopOnSelect toggle without a re-click', () => {
      // User clicked region → looping. Toggles loopOnSelect true mid-play. Next out should replay.
      const t = nextLoopState(looping('a'), { regionId: 'a', type: 'region-out' }, true);
      expect(t.action).toEqual({ regionId: 'a', type: 'replay' });
    });
  });

  describe('background-click', () => {
    it('clears selection from idle', () => {
      const t = nextLoopState(IDLE, { type: 'background-click' }, false);
      expect(t.state).toEqual(IDLE);
      expect(t.action).toEqual({ type: 'clear-selection' });
    });

    it('clears selection from looping', () => {
      const t = nextLoopState(looping('a'), { type: 'background-click' }, true);
      expect(t.state).toEqual(IDLE);
      expect(t.action).toEqual({ type: 'clear-selection' });
    });
  });

  describe('pause', () => {
    it('returns to idle without action', () => {
      const t = nextLoopState(looping('a'), { type: 'pause' }, true);
      expect(t.state).toEqual(IDLE);
      expect(t.action).toBeNull();
    });

    it('is a no-op from idle', () => {
      const t = nextLoopState(IDLE, { type: 'pause' }, true);
      expect(t.state).toEqual(IDLE);
      expect(t.action).toBeNull();
    });
  });
});
