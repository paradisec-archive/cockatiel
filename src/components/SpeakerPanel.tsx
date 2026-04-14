import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { getSpeakerColour, MAX_SPEAKERS } from '@/lib/constants';
import { useAppStore } from '@/lib/store';

export const SpeakerPanel = () => {
  const speakerNames = useAppStore((s) => s.speakerNames);
  const defaultSpeaker = useAppStore((s) => s.defaultSpeaker);
  const setSpeakerCount = useAppStore((s) => s.setSpeakerCount);
  const setSpeakerName = useAppStore((s) => s.setSpeakerName);
  const setDefaultSpeaker = useAppStore((s) => s.setDefaultSpeaker);
  const assignAllToSpeaker = useAppStore((s) => s.assignAllToSpeaker);

  const handleCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSpeakerCount(Number(e.target.value));
    },
    [setSpeakerCount],
  );

  return (
    <Collapsible defaultOpen className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center px-4 py-2.5 font-mono text-[0.75rem] font-medium hover:bg-muted/50">Speakers</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 px-4 pb-4">
          {/* Speaker count + default */}
          <div className="flex items-center gap-3">
            <label className="font-mono text-[0.7rem] text-muted-foreground">
              Count
              <input
                type="number"
                min={1}
                max={MAX_SPEAKERS}
                value={speakerNames.length}
                onChange={handleCountChange}
                className="ml-2 w-14 rounded-md border border-border bg-background px-2 py-1 text-center font-mono text-[0.75rem]"
              />
            </label>
            <label className="font-mono text-[0.7rem] text-muted-foreground">
              Default
              <select
                value={defaultSpeaker}
                onChange={(e) => setDefaultSpeaker(Number(e.target.value))}
                className="ml-2 rounded-md border border-border bg-background px-2 py-1 font-mono text-[0.75rem]"
              >
                {speakerNames.map((name, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable speaker identity; names are mutable
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Speaker rows */}
          {speakerNames.map((name, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable speaker identity; names are mutable and used as input values
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: getSpeakerColour(i) }} />
              <Input
                value={name}
                onChange={(e) => setSpeakerName(i, e.target.value)}
                className="h-7 flex-1 text-sm"
                style={{ borderLeftColor: getSpeakerColour(i), borderLeftWidth: '3px' }}
              />
              <Button variant="outline" size="sm" className="h-6 px-2 text-[0.65rem]" onClick={() => assignAllToSpeaker(i)}>
                Assign all
              </Button>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
