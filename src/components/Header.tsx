import { ArrowLeftIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/lib/store';

export const Header = () => {
  const mediaFileName = useAppStore((s) => s.mediaFileName);
  const appPhase = useAppStore((s) => s.appPhase);
  const title = useAppStore((s) => s.title);
  const fingerprint = useAppStore((s) => s.fingerprint);
  const setTitle = useAppStore((s) => s.setTitle);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleBackToSessions = useCallback(() => {
    useAppStore.getState().reset();
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    await useAppStore.getState().discardSession(fingerprint);
  }, [fingerprint]);

  const showBack = appPhase !== 'workbench';
  const showEditor = appPhase === 'processing' || appPhase === 'ready';
  const canDelete = appPhase === 'ready' && fingerprint !== '';

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4">
        <span className="font-semibold tracking-tight">Cockatiel</span>
        {showBack && (
          <Button variant="ghost" size="sm" onClick={handleBackToSessions} className="h-7 px-2 text-xs">
            <ArrowLeftIcon className="mr-1 h-3.5 w-3.5" />
            Sessions
          </Button>
        )}
        {showEditor && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            title={mediaFileName}
            placeholder={mediaFileName || 'Untitled'}
            className="ml-auto h-8 w-64 max-w-full truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-border hover:bg-muted/40 focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/50"
          />
        )}
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
              aria-label="Session options"
            >
              <MoreHorizontalIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2Icon className="h-4 w-4" />
                Delete session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>"{title || mediaFileName}" will be removed from your browser. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
};
