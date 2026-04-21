import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSession } from '@/lib/persistence/storage';
import { SAVE_DEBOUNCE_MS, startAutoSave } from '@/lib/persistence/subscribe';
import { useAppStore } from '@/lib/store';

const testStore = createStore('cockatiel', 'sessions');
const waitForDebounce = () => new Promise((r) => setTimeout(r, SAVE_DEBOUNCE_MS + 50));

describe('persistence/subscribe', () => {
  let stopAutoSave: (() => void) | null = null;

  beforeEach(async () => {
    await clear(testStore);
    useAppStore.getState().reset();
    stopAutoSave = startAutoSave();
  });

  afterEach(() => {
    stopAutoSave?.();
    stopAutoSave = null;
  });

  it('does not save while appPhase is not "ready"', async () => {
    const store = useAppStore.getState();
    store.setFingerprint('abc');
    store.setMediaFile('file.wav', 10);
    // appPhase is still 'workbench' (initial)
    await waitForDebounce();
    expect(await loadSession('abc')).toBeUndefined();
  });

  it('does not save when fingerprint is empty even if phase is ready', async () => {
    const store = useAppStore.getState();
    store.setAppPhase('ready');
    store.loadSegments([{ end: 1, start: 0 }]);
    await waitForDebounce();
    // No fingerprint was set, so no save happened for any key
    const s = useAppStore.getState();
    expect(s.fingerprint).toBe('');
  });

  it('saves after debounce when appPhase=ready and fingerprint is set', async () => {
    const store = useAppStore.getState();
    store.setFingerprint('abc');
    store.setMediaFile('a.wav', 10);
    store.loadSegments([{ end: 1, start: 0 }]);
    await waitForDebounce();
    const saved = await loadSession('abc');
    expect(saved).toBeDefined();
    expect(saved?.mediaFileName).toBe('a.wav');
    expect(saved?.segments).toHaveLength(1);
  });

  it('collapses rapid edits into a single save (debounce)', async () => {
    const store = useAppStore.getState();
    store.setFingerprint('abc');
    store.setMediaFile('a.wav', 10);
    store.loadSegments([{ end: 1, start: 0 }]);
    const segmentId = useAppStore.getState().segments[0].id;
    // Rapid edits within the debounce window
    store.updateSegmentText(segmentId, 'one');
    store.updateSegmentText(segmentId, 'two');
    store.updateSegmentText(segmentId, 'three');
    await waitForDebounce();
    const saved = await loadSession('abc');
    expect(saved?.segments[0].value).toBe('three');
  });

  it('ignores changes to transient UI state (selection, loop toggle)', async () => {
    const store = useAppStore.getState();
    store.setFingerprint('abc');
    store.setMediaFile('a.wav', 10);
    store.loadSegments([{ end: 1, start: 0 }]);
    await waitForDebounce();
    const firstUpdatedAt = (await loadSession('abc'))?.updatedAt ?? 0;

    // Pure UI-state changes should not bump updatedAt
    store.selectSegment(useAppStore.getState().segments[0].id);
    store.setLoopOnSelect(true);
    await waitForDebounce();
    const secondUpdatedAt = (await loadSession('abc'))?.updatedAt ?? 0;
    expect(secondUpdatedAt).toBe(firstUpdatedAt);
  });
});
