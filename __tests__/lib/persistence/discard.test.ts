import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSession, upsertSession } from '@/lib/persistence/storage';
import { useAppStore } from '@/lib/store';
import { makePayload as payload } from './test-util';

const testStore = createStore('cockatiel', 'sessions');

describe('useAppStore.discardSession', () => {
  beforeEach(async () => {
    await clear(testStore);
    useAppStore.getState().reset();
  });

  it('removes the session from IDB', async () => {
    await upsertSession(payload({ fingerprint: 'abc' }));
    await useAppStore.getState().discardSession('abc');
    expect(await loadSession('abc')).toBeUndefined();
  });

  it('clears in-memory state if the discarded fingerprint is currently loaded', async () => {
    const saved = await upsertSession(payload({ fingerprint: 'abc' }));
    useAppStore.getState().hydrateFromStoredSession(saved);
    expect(useAppStore.getState().fingerprint).toBe('abc');

    await useAppStore.getState().discardSession('abc');

    const state = useAppStore.getState();
    expect(state.fingerprint).toBe('');
    expect(state.segments).toEqual([]);
    expect(state.mediaFileName).toBe('');
  });

  it('leaves in-memory state alone when discarding a different session', async () => {
    const keep = await upsertSession(payload({ fingerprint: 'keep', mediaFileName: 'keep.wav' }));
    await upsertSession(payload({ fingerprint: 'drop', mediaFileName: 'drop.wav' }));
    useAppStore.getState().hydrateFromStoredSession(keep);

    await useAppStore.getState().discardSession('drop');

    const state = useAppStore.getState();
    expect(state.fingerprint).toBe('keep');
    expect(state.mediaFileName).toBe('keep.wav');
    expect(await loadSession('drop')).toBeUndefined();
    expect(await loadSession('keep')).toBeDefined();
  });
});
