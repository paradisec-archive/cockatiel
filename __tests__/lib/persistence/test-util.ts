import { DEFAULT_VAD_CONFIG } from '@/lib/constants';
import type { SessionPayload } from '@/lib/persistence/storage';

export const makePayload = (overrides: Partial<SessionPayload> = {}): SessionPayload => ({
  fingerprint: 'deadbeef',
  mediaDuration: 60,
  mediaFileName: 'test.wav',
  segments: [{ end: 1, id: 's1', speaker: 0, start: 0, value: 'hello' }],
  speakerNames: ['Speaker 1'],
  vadConfig: { ...DEFAULT_VAD_CONFIG },
  ...overrides,
});
