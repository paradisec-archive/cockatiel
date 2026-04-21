import { useAppStore } from '@/lib/store';
import { ensurePersistentStorage } from './grant';
import { type SessionPayload, upsertSession } from './storage';

export const SAVE_DEBOUNCE_MS = 500;

const pickPayload = (state: ReturnType<typeof useAppStore.getState>): SessionPayload => ({
  ...(state.fileHandle ? { fileHandle: state.fileHandle } : {}),
  fingerprint: state.fingerprint,
  mediaDuration: state.mediaDuration,
  mediaFileName: state.mediaFileName,
  segments: state.segments,
  speakerNames: state.speakerNames,
  title: state.title,
  vadConfig: state.vadConfig,
});

export const startAutoSave = (): (() => void) => {
  let lastKey = '';
  // Tracked separately: FileSystemFileHandle has no enumerable own properties,
  // so JSON.stringify renders it as `{}` and can't distinguish two handles.
  let lastHandle: FileSystemFileHandle | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = useAppStore.subscribe((state) => {
    if (state.appPhase !== 'ready' || !state.fingerprint) {
      return;
    }
    const payload = pickPayload(state);
    const key = JSON.stringify(payload);
    if (key === lastKey && state.fileHandle === lastHandle) {
      return;
    }
    lastKey = key;
    lastHandle = state.fileHandle;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      upsertSession(payload)
        .then(() => ensurePersistentStorage())
        .catch((err) => {
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
