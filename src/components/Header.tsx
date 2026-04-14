import { useAppStore } from '@/lib/store';

export const Header = () => {
  const mediaFileName = useAppStore((s) => s.mediaFileName);
  const appPhase = useAppStore((s) => s.appPhase);

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center px-4">
        <span className="font-semibold tracking-tight">Cockatiel</span>
        {appPhase !== 'upload' && mediaFileName && <span className="ml-auto font-mono text-xs text-muted-foreground">{mediaFileName}</span>}
      </div>
    </header>
  );
};
