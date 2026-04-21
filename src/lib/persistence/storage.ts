import { createStore, del, entries, get, set } from 'idb-keyval';
import { titleFromFileName } from '../utils';
import { SCHEMA_VERSION, type SessionSummary, type StoredSession } from './types';

const sessionsStore = createStore('cockatiel', 'sessions');

export type SessionPayload = Omit<StoredSession, 'createdAt' | 'schemaVersion' | 'updatedAt'>;

export const upsertSession = async (payload: SessionPayload): Promise<StoredSession> => {
  const existing = await get<StoredSession>(payload.fingerprint, sessionsStore);
  const now = Date.now();
  const session: StoredSession = {
    ...payload,
    createdAt: existing?.createdAt ?? now,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
  };
  await set(payload.fingerprint, session, sessionsStore);
  return session;
};

export const loadSession = async (fingerprint: string): Promise<StoredSession | undefined> => {
  const session = await get<StoredSession>(fingerprint, sessionsStore);
  if (!session || session.schemaVersion !== SCHEMA_VERSION) {
    return undefined;
  }
  return session;
};

export const loadMostRecentSession = async (): Promise<StoredSession | undefined> => {
  const all = await entries<string, StoredSession>(sessionsStore);
  let best: StoredSession | undefined;
  for (const [, session] of all) {
    if (session.schemaVersion !== SCHEMA_VERSION) {
      continue;
    }
    if (!best || session.updatedAt > best.updatedAt) {
      best = session;
    }
  }
  return best;
};

const summariseTranscript = (segments: StoredSession['segments']): { transcribedSegmentCount: number; wordCount: number } => {
  let transcribedSegmentCount = 0;
  let wordCount = 0;
  for (const seg of segments) {
    const trimmed = seg.value.trim();
    if (trimmed) {
      transcribedSegmentCount += 1;
      wordCount += trimmed.split(/\s+/).length;
    }
  }
  return { transcribedSegmentCount, wordCount };
};

export const listSessions = async (): Promise<SessionSummary[]> => {
  const all = await entries<string, StoredSession>(sessionsStore);
  return all
    .filter(([, s]) => s.schemaVersion === SCHEMA_VERSION)
    .map(([, s]) => ({
      fingerprint: s.fingerprint,
      mediaDuration: s.mediaDuration,
      mediaFileName: s.mediaFileName,
      segmentCount: s.segments.length,
      speakerCount: s.speakerNames.length,
      title: s.title || titleFromFileName(s.mediaFileName),
      updatedAt: s.updatedAt,
      ...summariseTranscript(s.segments),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteSession = async (fingerprint: string): Promise<void> => {
  await del(fingerprint, sessionsStore);
};
