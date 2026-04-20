import type WaveSurfer from 'wavesurfer.js';
import type RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { clientXToTime } from './click-math';
import { diffRegions } from './diff';
import { IDLE, type LoopState, nextLoopState } from './loop-state';
import type { DesiredState, RegionEvent, RegionSpec, RegionSync } from './types';

const UNSELECTED_ALPHA = '30';
const SELECTED_ALPHA = '55';

const tint = (colour: string, selected: boolean): string => `${colour}${selected ? SELECTED_ALPHA : UNSELECTED_ALPHA}`;

export const createWavesurferRegionSync = (
  ws: WaveSurfer,
  regions: RegionsPlugin,
  container: HTMLElement,
  colourFor: (speaker: number) => string,
): RegionSync => {
  const listeners = new Set<(event: RegionEvent) => void>();
  const lastSynced = new Map<string, RegionSpec>();
  let prevSelectedId: string | null = null;
  let loopState: LoopState = IDLE;
  let loopOnSelectNow = false;
  let justClickedRegion = false;

  const emit = (event: RegionEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const regionById = (): Map<string, ReturnType<RegionsPlugin['getRegions']>[number]> => {
    return new Map(regions.getRegions().map((r) => [r.id, r]));
  };

  const dispatch = (transitionState: LoopState, action: ReturnType<typeof nextLoopState>['action']): void => {
    loopState = transitionState;
    if (!action) {
      return;
    }
    switch (action.type) {
      case 'select': {
        emit({ id: action.regionId, type: 'selected' });
        break;
      }
      case 'clear-selection': {
        emit({ type: 'cleared' });
        break;
      }
      case 'replay': {
        const region = regionById().get(action.regionId);
        region?.play();
        break;
      }
    }
  };

  const unsubRegionClicked = regions.on('region-clicked', (region, e) => {
    e.stopPropagation();
    justClickedRegion = true;
    const { action, state } = nextLoopState(loopState, { regionId: region.id, type: 'region-clicked' }, loopOnSelectNow);
    dispatch(state, action);
    region.play();
  });

  const unsubRegionOut = regions.on('region-out', (region) => {
    const { action, state } = nextLoopState(loopState, { regionId: region.id, type: 'region-out' }, loopOnSelectNow);
    dispatch(state, action);
  });

  const unsubInteraction = ws.on('interaction', () => {
    if (justClickedRegion) {
      justClickedRegion = false;
      return;
    }
    const { action, state } = nextLoopState(loopState, { type: 'background-click' }, loopOnSelectNow);
    dispatch(state, action);
  });

  const unsubRegionUpdated = regions.on('region-updated', (region) => {
    const prev = lastSynced.get(region.id);
    if (prev) {
      lastSynced.set(region.id, { ...prev, end: region.end, start: region.start });
    }
    emit({ end: region.end, id: region.id, start: region.start, type: 'bounds-changed' });
  });

  const unsubPause = ws.on('pause', () => {
    const { action, state } = nextLoopState(loopState, { type: 'pause' }, loopOnSelectNow);
    dispatch(state, action);
  });

  const sync = (state: DesiredState): void => {
    loopOnSelectNow = state.loopOnSelect;

    const next = new Map(state.segments.map((s) => [s.id, s]));
    const ops = diffRegions(lastSynced, next);
    const regionMap = regionById();

    for (const id of ops.removes) {
      regionMap.get(id)?.remove();
      lastSynced.delete(id);
    }

    for (const spec of ops.adds) {
      const selected = spec.id === state.selectedId;
      regions.addRegion({
        color: tint(colourFor(spec.speaker), selected),
        drag: true,
        end: spec.end,
        id: spec.id,
        resize: true,
        start: spec.start,
      });
      lastSynced.set(spec.id, spec);
    }

    for (const spec of ops.updates) {
      const selected = spec.id === state.selectedId;
      regionMap.get(spec.id)?.setOptions({ color: tint(colourFor(spec.speaker), selected), end: spec.end, start: spec.start });
      lastSynced.set(spec.id, spec);
    }

    // Selection highlight: refresh tint for regions whose selected-ness changed
    // but whose bounds didn't (bounds-changed updates already re-tinted above).
    if (prevSelectedId !== state.selectedId) {
      const mapAfter = regionById();
      if (prevSelectedId && prevSelectedId !== state.selectedId) {
        const spec = lastSynced.get(prevSelectedId);
        if (spec) {
          mapAfter.get(prevSelectedId)?.setOptions({ color: tint(colourFor(spec.speaker), false) });
        }
      }
      if (state.selectedId && state.selectedId !== prevSelectedId) {
        const spec = lastSynced.get(state.selectedId);
        if (spec) {
          mapAfter.get(state.selectedId)?.setOptions({ color: tint(colourFor(spec.speaker), true) });
        }
      }
      prevSelectedId = state.selectedId;
    }
  };

  const on = (listener: (event: RegionEvent) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const mapClientXToTime = (clientX: number): number | null => {
    const duration = ws.getDuration();
    if (!duration) {
      return null;
    }
    const rect = container.getBoundingClientRect();
    return clientXToTime({
      clientX,
      configuredPxPerSec: ws.options.minPxPerSec ?? 0,
      containerLeft: rect.left,
      containerWidth: container.clientWidth,
      duration,
      scrollLeft: ws.getScroll(),
    });
  };

  const dispose = (): void => {
    unsubRegionClicked();
    unsubRegionOut();
    unsubInteraction();
    unsubRegionUpdated();
    unsubPause();
    listeners.clear();
  };

  return {
    clientXToTime: mapClientXToTime,
    dispose,
    on,
    sync,
  };
};
