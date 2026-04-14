import { PauseIcon, PlayIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TimeDisplay } from './TimeDisplay';
import { useWavesurferContext } from './Waveform';

export const Controls = () => {
  const { wavesurfer, isReady } = useWavesurferContext();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!wavesurfer) {
      return;
    }
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

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" className="h-8 gap-1.5 px-3" disabled={!isReady} onClick={handlePlayPause}>
        {isPlaying ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      <TimeDisplay />
    </div>
  );
};
