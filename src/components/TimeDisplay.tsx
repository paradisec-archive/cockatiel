import { useEffect, useRef } from 'react';
import { formatTime } from '@/lib/constants';
import { useWavesurferContext } from './Waveform';

export const TimeDisplay = () => {
  const { wavesurfer } = useWavesurferContext();
  const spanRef = useRef<HTMLSpanElement>(null);
  const durationRef = useRef('0:00.0');

  // Update duration once on ready
  useEffect(() => {
    if (!wavesurfer) {
      return;
    }
    const unsub = wavesurfer.on('ready', () => {
      durationRef.current = formatTime(wavesurfer.getDuration());
      if (spanRef.current) {
        spanRef.current.textContent = `0:00.0 / ${durationRef.current}`;
      }
    });
    return unsub;
  }, [wavesurfer]);

  // Update current time via ref (no re-renders at 60fps)
  useEffect(() => {
    if (!wavesurfer) {
      return;
    }
    const unsub = wavesurfer.on('timeupdate', (currentTime: number) => {
      if (spanRef.current) {
        spanRef.current.textContent = `${formatTime(currentTime)} / ${durationRef.current}`;
      }
    });
    return unsub;
  }, [wavesurfer]);

  return (
    <span ref={spanRef} className="font-mono text-xs tabular-nums text-muted-foreground">
      0:00.0 / 0:00.0
    </span>
  );
};
