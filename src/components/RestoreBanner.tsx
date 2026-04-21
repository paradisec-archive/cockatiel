import { InfoIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { getErrorMessage } from '@/lib/utils';

interface RestoreBannerProps {
  onResume: (file: File, handle: FileSystemFileHandle) => void;
}

export const RestoreBanner = ({ onResume }: RestoreBannerProps) => {
  const fingerprint = useAppStore((s) => s.fingerprint);
  const mediaFileName = useAppStore((s) => s.mediaFileName);
  const segmentCount = useAppStore((s) => s.segments.length);
  const fileHandle = useAppStore((s) => s.fileHandle);
  const [permission, setPermission] = useState<FileSystemPermissionState | null>(null);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    if (!fileHandle) {
      setPermission(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const state = await fileHandle.queryPermission({ mode: 'read' });
        if (!alive) {
          return;
        }
        setPermission(state);
        if (state === 'granted') {
          setResuming(true);
          const file = await fileHandle.getFile();
          if (!alive) {
            return;
          }
          onResume(file, fileHandle);
        }
      } catch (err) {
        console.error('Failed to query file permission:', err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fileHandle, onResume]);

  const handleContinue = useCallback(async () => {
    if (!fileHandle) {
      return;
    }
    try {
      const state = await fileHandle.requestPermission({ mode: 'read' });
      if (state !== 'granted') {
        setPermission('denied');
        toast.error('Permission denied. Drop the audio file below to continue.');
        return;
      }
      setResuming(true);
      const file = await fileHandle.getFile();
      onResume(file, fileHandle);
    } catch (err) {
      console.error('Failed to request file permission:', err);
      toast.error(`Could not access the file: ${getErrorMessage(err)}`);
    }
  }, [fileHandle, onResume]);

  if (!fingerprint || !mediaFileName) {
    return null;
  }

  const canResume = fileHandle !== null && permission !== 'denied';

  return (
    <div className="mx-auto mb-6 flex max-w-xl items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm">
      <InfoIcon className="h-4 w-4 shrink-0 text-accent" />
      <div className="flex-1">
        <p>
          Restoring your session for <span className="font-mono">{mediaFileName}</span>
        </p>
        <p className="text-muted-foreground">
          {segmentCount} saved {segmentCount === 1 ? 'segment' : 'segments'}.{' '}
          {canResume ? 'Resume without re-uploading.' : 'Drop the same audio file below to continue editing.'}
        </p>
      </div>
      {canResume && (
        <Button size="sm" onClick={handleContinue} disabled={resuming}>
          {resuming ? 'Opening…' : 'Continue'}
        </Button>
      )}
    </div>
  );
};
