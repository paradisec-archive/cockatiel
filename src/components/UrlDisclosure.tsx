import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UrlDisclosureProps {
  onLoad: (url: string) => void;
}

export const UrlDisclosure = ({ onLoad }: UrlDisclosureProps) => {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onLoad(trimmed);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-center">
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
          Or load from a URL
        </button>
      </div>
      {expanded && (
        <form onSubmit={handleSubmit} className="mx-auto mt-1 flex w-full max-w-md items-center gap-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://example.com/audio.wav"
            aria-label="Audio URL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <Button size="sm" variant="outline" type="submit" disabled={!value.trim()}>
            Load URL
          </Button>
        </form>
      )}
    </div>
  );
};
