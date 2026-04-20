import { MinusIcon, PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { fromSliderValue, MAX_PX_PER_SEC, toSliderValue } from '@/lib/media-player/zoom-math';
import { useMediaPlayer } from './Waveform';

// One click of +/- applies this factor — roughly one wheel tick.
const STEP_FACTOR = 1.25;

export const ZoomControl = () => {
  const player = useMediaPlayer();
  const [minPx, setMinPx] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!player) {
      setIsReady(false);
      setMinPx(0);
      setSliderValue(0);
      return;
    }
    const snapshot = player.getState();
    setIsReady(snapshot.isReady);
    setMinPx(snapshot.minPxPerSec);
    setSliderValue(toSliderValue(snapshot.pxPerSec, snapshot.minPxPerSec));

    return player.on((event) => {
      if (event.type === 'ready') {
        setIsReady(true);
        const s = player.getState();
        setMinPx(s.minPxPerSec);
        setSliderValue(0);
      } else if (event.type === 'zoom') {
        setMinPx(event.minPxPerSec);
        setSliderValue(toSliderValue(event.pxPerSec, event.minPxPerSec));
      }
    });
  }, [player]);

  const apply = useCallback(
    (next: number) => {
      setSliderValue(next);
      player?.setZoom(fromSliderValue(next, minPx));
    },
    [player, minPx],
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
