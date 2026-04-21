import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DropBar } from '@/components/DropBar';
import { DropZone } from '@/components/DropZone';
import { getStorageEstimate, isPersisted, type StorageUsage } from '@/lib/persistence/grant';
import { listSessions, loadSession } from '@/lib/persistence/storage';
import type { SessionSummary } from '@/lib/persistence/types';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface StorageInfo extends StorageUsage {
  persisted: boolean;
}

const formatBytes = (n: number): string => {
  if (n >= 1024 ** 3) {
    const gb = n / 1024 ** 3;
    return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
  }
  if (n >= 1024 ** 2) {
    return `${Math.round(n / 1024 ** 2)} MB`;
  }
  if (n >= 1024) {
    return `${Math.round(n / 1024)} KB`;
  }
  return `${n} B`;
};

interface WorkbenchProps {
  onFileSelected: (file: File, handle?: FileSystemFileHandle) => void;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const formatRelative = (ts: number): string => {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  if (abs < MINUTE) {
    return rtf.format(Math.round(diff / 1000), 'second');
  }
  if (abs < HOUR) {
    return rtf.format(Math.round(diff / MINUTE), 'minute');
  }
  if (abs < DAY) {
    return rtf.format(Math.round(diff / HOUR), 'hour');
  }
  if (abs < MONTH) {
    return rtf.format(Math.round(diff / DAY), 'day');
  }
  if (abs < YEAR) {
    return rtf.format(Math.round(diff / MONTH), 'month');
  }
  return rtf.format(Math.round(diff / YEAR), 'year');
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

const formatDuration = (seconds: number): string => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`;
};

const formatWordsShort = (n: number): string => {
  if (n < 1000) {
    return String(n);
  }
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
};

export const Workbench = ({ onFileSelected }: WorkbenchProps) => {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  const reload = useCallback(async () => {
    const list = await listSessions();
    setSessions(list);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!sessions || sessions.length === 0) {
      return;
    }
    let cancelled = false;
    Promise.all([getStorageEstimate(), isPersisted()]).then(([estimate, persisted]) => {
      if (cancelled || !estimate) {
        return;
      }
      setStorageInfo({ ...estimate, persisted });
    });
    return () => {
      cancelled = true;
    };
  }, [sessions]);

  const handleOpen = useCallback(
    async (fingerprint: string) => {
      const session = await loadSession(fingerprint);
      if (!session) {
        toast.error('Session no longer exists.');
        reload();
        return;
      }
      if (session.fileHandle) {
        try {
          const perm = await session.fileHandle.requestPermission({ mode: 'read' });
          if (perm === 'granted') {
            const file = await session.fileHandle.getFile();
            onFileSelected(file, session.fileHandle);
            return;
          }
        } catch (err) {
          console.error('Failed to request file permission:', err);
        }
      }
      useAppStore.getState().hydrateFromStoredSession(session);
      useAppStore.getState().setAppPhase('upload');
    },
    [onFileSelected, reload],
  );

  if (sessions === null) {
    return null;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="mb-8 max-w-lg text-center">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Audio Annotation Tool</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Automatically segment audio using voice activity detection, then edit, assign speakers, transcribe, and export to EAF, SRT, TextGrid, CSV, or plain
            text. All processing runs locally in your browser.
          </p>
        </div>
        <DropZone onFileSelected={onFileSelected} />
      </div>
    );
  }

  const totalDuration = sessions.reduce((sum, s) => sum + s.mediaDuration, 0);
  const totalWords = sessions.reduce((sum, s) => sum + s.wordCount, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-8">
      <DropBar onFileSelected={onFileSelected} />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-4 py-2 text-left font-medium">
                Project
              </th>
              <th scope="col" className="w-20 px-2 py-2 text-right font-medium">
                Duration
              </th>
              <th scope="col" className="w-36 px-2 py-2 text-left font-medium">
                Progress
              </th>
              <th scope="col" className="w-16 px-2 py-2 text-right font-medium">
                Words
              </th>
              <th scope="col" className="w-14 px-2 py-2 text-left font-medium">
                Spkrs
              </th>
              <th scope="col" className="w-24 px-4 py-2 text-left font-medium">
                Edited
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const percent = session.segmentCount ? Math.round((session.transcribedSegmentCount / session.segmentCount) * 100) : 0;
              return (
                <tr
                  key={session.fingerprint}
                  onClick={() => handleOpen(session.fingerprint)}
                  className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40 focus-within:bg-muted/40"
                >
                  <td className="max-w-0 px-4 py-2">
                    <button type="button" className="block w-full min-w-0 text-left outline-none" aria-label={`Open ${session.title}`}>
                      <p className="truncate font-medium focus-visible:underline">{session.title}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{session.mediaFileName}</p>
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatDuration(session.mediaDuration)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full', percent >= 100 ? 'bg-emerald-600' : 'bg-foreground')} style={{ width: `${percent}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{percent}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatWordsShort(session.wordCount)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{session.speakerCount}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatRelative(session.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs tabular-nums text-muted-foreground">
        <span>
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
        <span>Total {formatDuration(totalDuration)}</span>
        <span>{totalWords.toLocaleString()} words</span>
        <span className="ml-auto">
          {storageInfo ? (
            <>
              {formatBytes(storageInfo.usage)} of {formatBytes(storageInfo.quota)} used
              {!storageInfo.persisted && <span className="text-destructive"> · ⚠ May be cleared by browser</span>}
            </>
          ) : (
            'Stored locally in IndexedDB'
          )}
        </span>
      </div>
    </div>
  );
};
