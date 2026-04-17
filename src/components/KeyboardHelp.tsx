import { useCallback, useEffect, useRef } from 'react';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { isFormElement } from '@/lib/utils';

interface MouseAction {
  action: string;
  description: string;
}

const MOUSE_ACTIONS: MouseAction[] = [
  { action: 'Click', description: 'Select segment & loop playback' },
  { action: 'Double-click', description: 'Split segment at click' },
  { action: 'Drag', description: 'Move or resize segment' },
  { action: 'Scroll', description: 'Zoom waveform' },
];

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{children}</kbd>
);

interface KeyboardHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeyboardHelp = ({ open, onOpenChange }: KeyboardHelpProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isFormElement(e.target)) {
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        onOpenChangeRef.current(!openRef.current);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard equivalent (Escape) is handled natively by <dialog>
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleBackdropClick}
      className="m-auto w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Keyboard Shortcuts</h2>
        <dl className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <dt className="text-sm text-foreground">{s.description}</dt>
              <dd>
                <Kbd>{s.key}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="mt-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mouse</h2>
        <dl className="space-y-1.5">
          {MOUSE_ACTIONS.map((m) => (
            <div key={m.action} className="flex items-center justify-between">
              <dt className="text-sm text-foreground">{m.description}</dt>
              <dd>
                <Kbd>{m.action}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </dialog>
  );
};
