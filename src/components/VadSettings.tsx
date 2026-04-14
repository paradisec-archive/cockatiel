import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { useAppStore } from '@/lib/store';

interface VadSettingsProps {
  onResegment: () => void;
}

export const VadSettings = ({ onResegment }: VadSettingsProps) => {
  const vadConfig = useAppStore((s) => s.vadConfig);
  const setVadConfig = useAppStore((s) => s.setVadConfig);

  return (
    <Collapsible className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center px-4 py-2.5 font-mono text-[0.75rem] font-medium hover:bg-muted/50">
        VAD Settings (advanced)
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 px-4 pb-4">
          <SliderRow label="Threshold" value={vadConfig.threshold} min={0.1} max={0.9} step={0.05} onChange={(v) => setVadConfig({ threshold: v })} />
          <SliderRow
            label="Min silence"
            value={vadConfig.minSilenceDuration}
            min={0.1}
            max={2.0}
            step={0.05}
            unit="s"
            onChange={(v) => setVadConfig({ minSilenceDuration: v })}
          />
          <SliderRow
            label="Min speech"
            value={vadConfig.minSpeechDuration}
            min={0.1}
            max={2.0}
            step={0.05}
            unit="s"
            onChange={(v) => setVadConfig({ minSpeechDuration: v })}
          />
          <SliderRow
            label="Max speech"
            value={vadConfig.maxSpeechDuration}
            min={5}
            max={60}
            step={1}
            unit="s"
            onChange={(v) => setVadConfig({ maxSpeechDuration: v })}
          />
          <Button variant="outline" size="sm" className="w-full" onClick={onResegment}>
            Re-segment with new settings
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const SliderRow = ({
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) => {
  return (
    <div className="grid grid-cols-[110px_1fr_45px] items-center gap-2">
      <span className="font-mono text-[0.68rem] text-muted-foreground">{label}</span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(vals) => onChange(Array.isArray(vals) ? vals[0] : vals)} />
      <span className="text-right font-mono text-[0.72rem]">
        {value}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
};
