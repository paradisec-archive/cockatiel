import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/lib/store';

interface StatusBarProps {
  onCancel?: () => void;
}

export const StatusBar = ({ onCancel }: StatusBarProps) => {
  const statusMessage = useAppStore((s) => s.statusMessage);
  const progress = useAppStore((s) => s.processingProgress);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16">
      <p className="mb-3 font-mono text-sm">{statusMessage || 'Processing...'}</p>
      <Progress value={progress * 100} className="h-1.5 w-full" />
      <p className="mt-2 font-mono text-xs text-muted-foreground">{Math.round(progress * 100)}%</p>
      {onCancel && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
};
