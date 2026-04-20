import { Loader2Icon } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useMediaPlayerBridge } from '@/hooks/useMediaPlayerBridge';
import { getSpeakerColour } from '@/lib/constants';
import type { MediaPlayer, Viewport } from '@/lib/media-player/types';
import { createWavesurferMediaPlayer } from '@/lib/media-player/wavesurfer';
import { useAppStore } from '@/lib/store';
import { SegmentContextMenu } from './SegmentContextMenu';

const MediaPlayerContext = createContext<MediaPlayer | null>(null);

export const useMediaPlayer = (): MediaPlayer | null => useContext(MediaPlayerContext);

export type TimelineViewport = Viewport;

interface WaveformProps {
  audioFile: File | null;
  children?: React.ReactNode;
  onViewportChange?: (viewport: TimelineViewport) => void;
}

export const Waveform = ({ audioFile, children, onViewportChange }: WaveformProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<MediaPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const p = createWavesurferMediaPlayer(container, getSpeakerColour);
    setPlayer(p);
    return () => {
      p.dispose();
      setPlayer(null);
    };
  }, []);

  useEffect(() => {
    if (!player || !audioFile) {
      return;
    }
    player.loadBlob(audioFile).catch((err: unknown) => {
      console.error('Failed to load audio:', err);
      useAppStore.getState().setStatus(`Error loading audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      useAppStore.getState().setAppPhase('upload');
    });
  }, [player, audioFile]);

  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  useEffect(() => {
    if (!player) {
      setIsReady(false);
      return;
    }
    const snapshot = player.getState();
    setIsReady(snapshot.isReady);
    if (snapshot.viewport.pixelsPerSecond > 0) {
      onViewportChangeRef.current?.(snapshot.viewport);
    }
    return player.on((event) => {
      switch (event.type) {
        case 'ready':
          setIsReady(true);
          break;
        case 'viewport':
          onViewportChangeRef.current?.(event.viewport);
          break;
      }
    });
  }, [player]);

  const { getClickContext } = useMediaPlayerBridge(player);

  return (
    <MediaPlayerContext.Provider value={player}>
      <div className="space-y-0.5">
        <div className="flex items-stretch">
          <div className="flex w-25 shrink-0 items-center rounded-l-md border border-r-0 border-border bg-waveform-bg px-2.5 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/50">
            Waveform
          </div>

          <SegmentContextMenu getClickContext={getClickContext} className="min-w-0 flex-1">
            <div className="relative">
              <div ref={containerRef} className="min-h-40 overflow-hidden rounded-r-lg border border-border bg-waveform-bg" />
              {!isReady && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2Icon className="size-5 animate-spin" />
                  <span className="font-mono text-xs uppercase tracking-widest">Loading audio…</span>
                </div>
              )}
            </div>
          </SegmentContextMenu>
        </div>

        {children}
      </div>
    </MediaPlayerContext.Provider>
  );
};
