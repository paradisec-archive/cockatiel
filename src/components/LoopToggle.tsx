import { useAppStore } from '@/lib/store';

export const LoopToggle = () => {
  const loopOnSelect = useAppStore((s) => s.loopOnSelect);
  const setLoopOnSelect = useAppStore((s) => s.setLoopOnSelect);

  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/70 hover:text-foreground">
      <input
        type="checkbox"
        checked={loopOnSelect}
        onChange={(e) => setLoopOnSelect(e.target.checked)}
        className="size-3 accent-primary"
        aria-label="Loop selected region"
      />
      Loop
    </label>
  );
};
