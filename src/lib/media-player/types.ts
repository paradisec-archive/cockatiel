import type { DesiredRegions, RegionSpec } from './region-sync/types';

export type { DesiredRegions, RegionSpec };

export interface Viewport {
  pixelsPerSecond: number;
  visibleEndTime: number;
  visibleStartTime: number;
}

export interface MediaPlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  minPxPerSec: number;
  pxPerSec: number;
  viewport: Viewport;
}

export type MediaPlayerEvent =
  | { type: 'ready'; duration: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'timeupdate'; currentTime: number }
  | { type: 'zoom'; pxPerSec: number; minPxPerSec: number }
  | { type: 'viewport'; viewport: Viewport }
  | { type: 'region-selected'; id: string }
  | { type: 'region-cleared' }
  | { type: 'region-bounds-changed'; id: string; start: number; end: number };

export interface MediaPlayer {
  clientXToTime(clientX: number): number | null;
  dispose(): void;
  getState(): MediaPlayerState;
  loadBlob(file: File): Promise<void>;
  on(listener: (event: MediaPlayerEvent) => void): () => void;
  pause(): void;
  play(): void;
  playPause(): void;
  seek(time: number): void;
  setZoom(pxPerSec: number): void;
  skip(delta: number): void;
  syncRegions(state: DesiredRegions): void;
  zoomToWindow(start: number, end: number): void;
}
