import { Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DropZone } from '@/components/DropZone';
import { Button } from '@/components/ui/button';
import { listSessions, loadSession } from '@/lib/persistence/storage';
import type { SessionSummary } from '@/lib/persistence/types';
import { useAppStore } from '@/lib/store';
import { pluralizeSegment } from '@/lib/utils';

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

export const Workbench = ({ onFileSelected }: WorkbenchProps) => {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  const reload = useCallback(async () => {
    const list = await listSessions();
    setSessions(list);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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

  const handleDelete = useCallback(async (session: SessionSummary) => {
    const confirmed = window.confirm(`Delete saved session for "${session.mediaFileName}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setSessions((prev) => prev?.filter((s) => s.fingerprint !== session.fingerprint) ?? prev);
    await useAppStore.getState().discardSession(session.fingerprint);
  }, []);

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

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Your sessions</h2>
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.fingerprint} className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => handleOpen(session.fingerprint)}
                className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:border-accent hover:bg-accent/5"
              >
                <p className="font-medium">{session.mediaFileName}</p>
                <p className="text-sm text-muted-foreground">
                  {pluralizeSegment(session.segmentCount)} · edited {formatRelative(session.updatedAt)}
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(session)}
                aria-label={`Delete session for ${session.mediaFileName}`}
                className="self-center text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Start a new session</h2>
        <DropZone onFileSelected={onFileSelected} />
      </section>
    </div>
  );
};
