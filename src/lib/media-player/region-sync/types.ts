export interface RegionSpec {
  end: number;
  id: string;
  speaker: number;
  start: number;
}

export interface DesiredRegions {
  loopOnSelect: boolean;
  segments: RegionSpec[];
  selectedId: string | null;
}

export type RegionEvent = { type: 'bounds-changed'; id: string; start: number; end: number } | { type: 'selected'; id: string } | { type: 'cleared' };

export interface RegionSync {
  clientXToTime(clientX: number): number | null;
  dispose(): void;
  on(listener: (event: RegionEvent) => void): () => void;
  sync(state: DesiredRegions): void;
}
