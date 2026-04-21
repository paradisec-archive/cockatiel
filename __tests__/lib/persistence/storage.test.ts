import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VAD_CONFIG } from '@/lib/constants';
import { deleteSession, listSessions, loadMostRecentSession, loadSession, type SessionPayload, upsertSession } from '@/lib/persistence/storage';
import { SCHEMA_VERSION } from '@/lib/persistence/types';

const testStore = createStore('cockatiel', 'sessions');

const payload = (overrides: Partial<SessionPayload> = {}): SessionPayload => ({
  fingerprint: 'deadbeef',
  mediaDuration: 60,
  mediaFileName: 'test.wav',
  segments: [{ end: 1, id: 's1', speaker: 0, start: 0, value: 'hello' }],
  speakerNames: ['Speaker 1'],
  vadConfig: { ...DEFAULT_VAD_CONFIG },
  ...overrides,
});

describe('persistence/storage', () => {
  beforeEach(async () => {
    await clear(testStore);
  });

  describe('upsertSession', () => {
    it('creates a new session with schemaVersion, createdAt, updatedAt', async () => {
      const before = Date.now();
      const saved = await upsertSession(payload());
      expect(saved.schemaVersion).toBe(SCHEMA_VERSION);
      expect(saved.createdAt).toBeGreaterThanOrEqual(before);
      expect(saved.updatedAt).toBe(saved.createdAt);
    });

    it('preserves createdAt across subsequent upserts', async () => {
      const first = await upsertSession(payload());
      await new Promise((r) => setTimeout(r, 5));
      const second = await upsertSession(payload({ mediaFileName: 'renamed.wav' }));
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
      expect(second.mediaFileName).toBe('renamed.wav');
    });
  });

  describe('loadSession', () => {
    it('returns undefined for an unknown fingerprint', async () => {
      expect(await loadSession('missing')).toBeUndefined();
    });

    it('round-trips a stored session', async () => {
      await upsertSession(payload());
      const loaded = await loadSession('deadbeef');
      expect(loaded?.mediaFileName).toBe('test.wav');
      expect(loaded?.segments).toHaveLength(1);
    });

    it('ignores records with mismatched schemaVersion', async () => {
      // Simulate a future record by writing directly
      const { set } = await import('idb-keyval');
      await set('future', { ...payload({ fingerprint: 'future' }), createdAt: 0, schemaVersion: 999, updatedAt: 0 }, testStore);
      expect(await loadSession('future')).toBeUndefined();
    });
  });

  describe('loadMostRecentSession', () => {
    it('returns undefined when the store is empty', async () => {
      expect(await loadMostRecentSession()).toBeUndefined();
    });

    it('returns the session with the latest updatedAt', async () => {
      await upsertSession(payload({ fingerprint: 'a', mediaFileName: 'a.wav' }));
      await new Promise((r) => setTimeout(r, 5));
      await upsertSession(payload({ fingerprint: 'b', mediaFileName: 'b.wav' }));
      await new Promise((r) => setTimeout(r, 5));
      await upsertSession(payload({ fingerprint: 'a', mediaFileName: 'a-updated.wav' }));
      const recent = await loadMostRecentSession();
      expect(recent?.fingerprint).toBe('a');
      expect(recent?.mediaFileName).toBe('a-updated.wav');
    });
  });

  describe('listSessions', () => {
    it('returns summaries sorted by updatedAt desc', async () => {
      await upsertSession(payload({ fingerprint: 'a' }));
      await new Promise((r) => setTimeout(r, 5));
      await upsertSession(payload({ fingerprint: 'b' }));
      const list = await listSessions();
      expect(list.map((s) => s.fingerprint)).toEqual(['b', 'a']);
      expect(list[0].segmentCount).toBe(1);
    });
  });

  describe('deleteSession', () => {
    it('removes a session by fingerprint', async () => {
      await upsertSession(payload());
      await deleteSession('deadbeef');
      expect(await loadSession('deadbeef')).toBeUndefined();
    });
  });
});
