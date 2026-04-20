import { PauseIcon, PlayIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TimeDisplay } from './TimeDisplay';
import { useMediaPlayer } from './Waveform';

export const Controls = () => {
  const player = useMediaPlayer();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!player) {
      setIsPlaying(false);
      setIsReady(false);
      return;
    }
    const snapshot = player.getState();
    setIsPlaying(snapshot.isPlaying);
    setIsReady(snapshot.isReady);
    return player.on((event) => {
      switch (event.type) {
        case 'ready':
          setIsReady(true);
          break;
        case 'play':
          setIsPlaying(true);
          break;
        case 'pause':
          setIsPlaying(false);
          break;
      }
    });
  }, [player]);

  const handlePlayPause = useCallback(() => {
    player?.playPause();
  }, [player]);

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
