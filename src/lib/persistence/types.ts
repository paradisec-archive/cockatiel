import type { ExportData } from '@/lib/export/types';
import type { VadConfig } from '@/lib/vad';

export const SCHEMA_VERSION = 1 as const;

export interface StoredSession extends ExportData {
  createdAt: number;
  fileHandle?: FileSystemFileHandle;
  fingerprint: string;
  schemaVersion: typeof SCHEMA_VERSION;
  updatedAt: number;
  vadConfig: VadConfig;
}

export interface SessionSummary {
  fingerprint: string;
  mediaDuration: number;
  mediaFileName: string;
  segmentCount: number;
  updatedAt: number;
}
