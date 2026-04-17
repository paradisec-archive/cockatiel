interface HelpButtonProps {
  onOpen: () => void;
}

export const HelpButton = ({ onOpen }: HelpButtonProps) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label="Keyboard shortcuts"
    title="Keyboard shortcuts (?)"
    className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    ?
  </button>
);
