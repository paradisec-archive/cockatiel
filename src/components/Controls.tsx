import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TimeDisplay } from './TimeDisplay';
import { useWavesurferContext } from './Waveform';

export const Controls = () => {
  const { wavesurfer, isReady } = useWavesurferContext();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!wavesurfer) return;
    const unsubPlay = wavesurfer.on('play', () => setIsPlaying(true));
    const unsubPause = wavesurfer.on('pause', () => setIsPlaying(false));
    return () => {
      unsubPlay();
      unsubPause();
    };
  }, [wavesurfer]);

  const handlePlayPause = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);

  const handleStop = useCallback(() => {
    wavesurfer?.stop();
  }, [wavesurfer]);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-8 w-8 p-0 font-mono" disabled={!isReady} onClick={handleStop}>
        ⏹
      </Button>
      <Button size="sm" className="h-8 px-3 font-mono" disabled={!isReady} onClick={handlePlayPause}>
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </Button>
      <TimeDisplay />
    </div>
  );
};
