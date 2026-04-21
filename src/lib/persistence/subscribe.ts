import { useAppStore } from '@/lib/store';
import { type SessionPayload, upsertSession } from './storage';

export const SAVE_DEBOUNCE_MS = 500;

const pickPayload = (state: ReturnType<typeof useAppStore.getState>): SessionPayload => ({
  fingerprint: state.fingerprint,
  mediaDuration: state.mediaDuration,
  mediaFileName: state.mediaFileName,
  segments: state.segments,
  speakerNames: state.speakerNames,
  vadConfig: state.vadConfig,
});

export const startAutoSave = (): (() => void) => {
  let lastKey = '';
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = useAppStore.subscribe((state) => {
    if (state.appPhase !== 'ready' || !state.fingerprint) {
      return;
    }
    const payload = pickPayload(state);
    const key = JSON.stringify(payload);
    if (key === lastKey) {
      return;
    }
    lastKey = key;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      upsertSession(payload).catch((err) => {
        console.error('Session save failed:', err);
      });
    }, SAVE_DEBOUNCE_MS);
  });

  return () => {
    unsubscribe();
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
};
