import { MinusIcon, PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { MAX_PX_PER_SEC } from '@/lib/zoom';
import { useWavesurferContext } from './Waveform';

// One click of +/- applies this factor — roughly one wheel tick.
const STEP_FACTOR = 1.25;

const clamp01 = (v: number) => Math.max(0, Math.min(100, v));

const toSlider = (px: number, minPx: number) => {
  if (minPx <= 0 || px <= minPx) {
    return 0;
  }
  return (Math.log(px / minPx) / Math.log(MAX_PX_PER_SEC / minPx)) * 100;
};

const fromSlider = (value: number, minPx: number) => {
  return minPx * (MAX_PX_PER_SEC / minPx) ** (value / 100);
};

export const ZoomControl = () => {
  const { containerRef, wavesurfer, isReady } = useWavesurferContext();
  const [minPx, setMinPx] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);

  useEffect(() => {
    if (!wavesurfer || !isReady) {
      return;
    }
    const duration = wavesurfer.getDuration();
    const width = containerRef?.current?.clientWidth ?? 0;
    if (duration > 0 && width > 0) {
      setMinPx(width / duration);
      setSliderValue(0);
    }
  }, [wavesurfer, isReady, containerRef]);

  useEffect(() => {
    if (!wavesurfer || minPx <= 0) {
      return;
    }
    const unsub = wavesurfer.on('zoom', (px: number) => {
      const next = clamp01(toSlider(px, minPx));
      // Skip re-renders caused by log/exp round-trip after our own apply() call.
      setSliderValue((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    });
    return () => unsub();
  }, [wavesurfer, minPx]);

  const apply = useCallback(
    (next: number) => {
      const clamped = clamp01(next);
      setSliderValue(clamped);
      wavesurfer?.zoom(fromSlider(clamped, minPx));
    },
    [wavesurfer, minPx],
  );

  const stepDelta = useMemo(() => {
    if (minPx <= 0) {
      return 5;
    }
    return (100 * Math.log(STEP_FACTOR)) / Math.log(MAX_PX_PER_SEC / minPx);
  }, [minPx]);

  const handleSliderChange = useCallback(
    (value: number | readonly number[]) => {
      apply(Array.isArray(value) ? value[0] : value);
    },
    [apply],
  );

  const disabled = !isReady || minPx <= 0;

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/70">Zoom</span>
      <Button variant="outline" size="icon-xs" disabled={disabled} aria-label="Zoom out" onClick={() => apply(sliderValue - stepDelta)}>
        <MinusIcon />
      </Button>
      <div className="w-28 shrink-0">
        <Slider value={[sliderValue]} min={0} max={100} step={0.1} disabled={disabled} onValueChange={handleSliderChange} aria-label="Zoom" />
      </div>
      <Button variant="outline" size="icon-xs" disabled={disabled} aria-label="Zoom in" onClick={() => apply(sliderValue + stepDelta)}>
        <PlusIcon />
      </Button>
    </div>
  );
};
