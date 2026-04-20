export type LoopState = { kind: 'idle' } | { kind: 'looping'; regionId: string };

type LoopEvent = { type: 'region-clicked'; regionId: string } | { type: 'region-out'; regionId: string } | { type: 'background-click' } | { type: 'pause' };

type LoopAction = { type: 'select'; regionId: string } | { type: 'clear-selection' } | { type: 'replay'; regionId: string };

export const IDLE: LoopState = { kind: 'idle' };

interface Transition {
  action: LoopAction | null;
  state: LoopState;
}

export const nextLoopState = (state: LoopState, event: LoopEvent, loopOnSelect: boolean): Transition => {
  switch (event.type) {
    case 'region-clicked': {
      return { action: { type: 'select', regionId: event.regionId }, state: { kind: 'looping', regionId: event.regionId } };
    }

    case 'region-out': {
      if (state.kind !== 'looping' || state.regionId !== event.regionId) {
        return { action: null, state };
      }
      if (!loopOnSelect) {
        return { action: null, state: IDLE };
      }
      return { action: { type: 'replay', regionId: event.regionId }, state };
    }

    case 'background-click': {
      return { action: { type: 'clear-selection' }, state: IDLE };
    }

    case 'pause': {
      return { action: null, state: IDLE };
    }
  }
};
