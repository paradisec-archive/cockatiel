import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatBytes } from '@/lib/utils';

interface ConfirmDownloadDialogProps {
  filename: string;
  host: string;
  onCancel: () => void;
  onConfirm: (dontAskAgain: boolean) => void;
  open: boolean;
  size?: number;
}

export const ConfirmDownloadDialog = ({ filename, host, onCancel, onConfirm, open, size }: ConfirmDownloadDialogProps) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const confirmedRef = useRef(false);

  // Reset local state when the dialog reopens.
  useEffect(() => {
    if (open) {
      setDontAskAgain(false);
      confirmedRef.current = false;
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !confirmedRef.current) {
      onCancel();
    }
  };

  const handleConfirm = () => {
    confirmedRef.current = true;
    onConfirm(dontAskAgain);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Load audio from URL?</AlertDialogTitle>
        </AlertDialogHeader>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">File</dt>
          <dd className="truncate font-mono">{filename}</dd>
          <dt className="text-muted-foreground">Host</dt>
          <dd className="truncate font-mono">{host}</dd>
          <dt className="text-muted-foreground">Size</dt>
          <dd className="font-mono">{size === undefined ? 'Unknown' : formatBytes(size)}</dd>
        </dl>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-foreground"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
          />
          Don't ask me again
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Load</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
