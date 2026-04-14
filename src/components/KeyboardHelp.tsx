import { useCallback, useEffect, useRef, useState } from 'react';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { isFormElement } from '@/lib/utils';

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{children}</kbd>
);

export const KeyboardHelp = () => {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isFormElement(e.target)) {
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Sync dialog open state with showModal/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="m-auto w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Keyboard Shortcuts</h2>
      <dl className="space-y-1.5">
        {SHORTCUTS.map((s) => (
          <div key={s.key} className="flex items-center justify-between">
            <dt className="text-sm text-foreground">{s.description}</dt>
            <dd>
              <Kbd>{s.key}</Kbd>
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <dt className="text-sm text-foreground">Split segment at click</dt>
          <dd>
            <Kbd>Double-click</Kbd>
          </dd>
        </div>
      </dl>
    </dialog>
  );
};
