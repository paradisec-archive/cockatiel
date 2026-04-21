import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

export const Header = () => {
  const mediaFileName = useAppStore((s) => s.mediaFileName);
  const appPhase = useAppStore((s) => s.appPhase);

  const handleBackToSessions = () => {
    useAppStore.getState().reset();
  };

  const showBack = appPhase !== 'workbench';
  const showFileName = appPhase === 'processing' || appPhase === 'ready';

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
        {showFileName && mediaFileName && <span className="ml-auto font-mono text-xs text-muted-foreground">{mediaFileName}</span>}
      </div>
    </header>
  );
};
