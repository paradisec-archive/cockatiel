import { InfoIcon } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export const RestoreBanner = () => {
  const fingerprint = useAppStore((s) => s.fingerprint);
  const mediaFileName = useAppStore((s) => s.mediaFileName);
  const segmentCount = useAppStore((s) => s.segments.length);

  if (!fingerprint || !mediaFileName) {
    return null;
  }

  return (
    <div className="mx-auto mb-6 flex max-w-xl items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm">
      <InfoIcon className="h-4 w-4 shrink-0 text-accent" />
      <div>
        <p>
          Restoring your session for <span className="font-mono">{mediaFileName}</span>
        </p>
        <p className="text-muted-foreground">
          {segmentCount} saved {segmentCount === 1 ? 'segment' : 'segments'}. Drop the same audio file below to continue editing.
        </p>
      </div>
    </div>
  );
};
