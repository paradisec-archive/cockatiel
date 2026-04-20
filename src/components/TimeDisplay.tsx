import { useEffect, useRef } from 'react';
import { formatTime } from '@/lib/constants';
import { useMediaPlayer } from './Waveform';

export const TimeDisplay = () => {
  const player = useMediaPlayer();
  const spanRef = useRef<HTMLSpanElement>(null);
  const durationRef = useRef('0:00.0');

  useEffect(() => {
    if (!player) {
      return;
    }
    const snapshot = player.getState();
    if (snapshot.isReady) {
      durationRef.current = formatTime(snapshot.duration);
      if (spanRef.current) {
        spanRef.current.textContent = `${formatTime(snapshot.currentTime)} / ${durationRef.current}`;
      }
    }
    return player.on((event) => {
      if (event.type === 'ready') {
        durationRef.current = formatTime(event.duration);
        if (spanRef.current) {
          spanRef.current.textContent = `0:00.0 / ${durationRef.current}`;
        }
      } else if (event.type === 'timeupdate') {
        if (spanRef.current) {
          spanRef.current.textContent = `${formatTime(event.currentTime)} / ${durationRef.current}`;
        }
      }
    });
  }, [player]);

  return (
    <span ref={spanRef} className="font-mono text-xs tabular-nums text-muted-foreground">
      0:00.0 / 0:00.0
    </span>
  );
};
