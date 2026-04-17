import { create } from 'zustand';
import { DEFAULT_VAD_CONFIG, MAX_SPEAKERS } from './constants';
import type { VadConfig, VadSegment } from './vad-processor';

export interface Annotation {
  end: number;
  id: string;
  speaker: number;
  start: number;
  value: string;
}

type AppPhase = 'upload' | 'processing' | 'ready';

interface AppState {
  appPhase: AppPhase;
  defaultSpeaker: number;
  loopOnSelect: boolean;
  mediaDuration: number;
  mediaFileName: string;
  processingProgress: number;
  segments: Annotation[];
  selectedSegmentId: string | null;
  speakerNames: string[];
  statusMessage: string;
  vadConfig: VadConfig;

  assignAllToSpeaker: (speakerIndex: number) => void;
  assignSpeaker: (segmentId: string, speakerIndex: number) => void;
  clearSegments: () => void;
  createSegment: (start: number, end: number, speakerIndex: number) => string;
  deleteSegment: (id: string) => void;
  loadSegments: (segments: VadSegment[]) => void;
  mergeWithNext: (id: string) => void;
  mergeWithPrevious: (id: string) => void;
  reset: () => void;
  selectSegment: (id: string | null) => void;
  selectAdjacentSegment: (direction: 'prev' | 'next') => void;
  setLoopOnSelect: (value: boolean) => void;
  splitSegment: (id: string, atTime: number) => void;
  setAppPhase: (phase: AppPhase) => void;
  setDefaultSpeaker: (index: number) => void;
  setMediaFile: (name: string, duration: number) => void;
  setProgress: (fraction: number) => void;
  setSpeakerCount: (count: number) => void;
  setSpeakerName: (index: number, name: string) => void;
  setStatus: (message: string) => void;
  setVadConfig: (config: Partial<VadConfig>) => void;
  updateSegmentBounds: (id: string, start: number, end: number) => void;
  updateSegmentText: (id: string, value: string) => void;
}

export const sortByStart = (segs: Annotation[]) => [...segs].sort((a, b) => a.start - b.start);

export const findSegmentAtTime = (segs: Annotation[], time: number) => segs.find((s) => time >= s.start && time <= s.end);

// Seconds of silence left on either side of a split point, so adjacent
// segments don't share an edge and stay visually distinct.
const SPLIT_GAP = 0.05;

export const canSplitAt = (seg: Pick<Annotation, 'start' | 'end'>, time: number) => time > seg.start + SPLIT_GAP && time < seg.end - SPLIT_GAP;

const initialState = {
  appPhase: 'upload' as AppPhase,
  defaultSpeaker: 0,
  loopOnSelect: false,
  mediaDuration: 0,
  mediaFileName: '',
  processingProgress: 0,
  segments: [] as Annotation[],
  selectedSegmentId: null as string | null,
  speakerNames: ['Speaker 1'],
  statusMessage: '',
  vadConfig: { ...DEFAULT_VAD_CONFIG },
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setMediaFile: (name, duration) => set({ mediaFileName: name, mediaDuration: duration }),
  setAppPhase: (phase) => set({ appPhase: phase }),
  setStatus: (message) => set({ statusMessage: message }),
  setProgress: (fraction) => set({ processingProgress: fraction }),

  loadSegments: (vadSegments) => {
    const { defaultSpeaker } = get();
    const segments: Annotation[] = vadSegments.map((seg) => ({
      end: seg.end,
      id: crypto.randomUUID(),
      speaker: defaultSpeaker,
      start: seg.start,
      value: '',
    }));
    set({ appPhase: 'ready', processingProgress: 0, segments, statusMessage: '' });
  },

  updateSegmentBounds: (id, start, end) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? { ...s, start, end } : s)),
    })),

  updateSegmentText: (id, value) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? { ...s, value } : s)),
    })),

  selectSegment: (id) => set({ selectedSegmentId: id }),

  setLoopOnSelect: (value) => set({ loopOnSelect: value }),

  selectAdjacentSegment: (direction) =>
    set((state) => {
      const sorted = sortByStart(state.segments);
      if (!sorted.length) {
        return state;
      }
      const idx = sorted.findIndex((s) => s.id === state.selectedSegmentId);
      if (idx === -1) {
        return { selectedSegmentId: sorted[0].id };
      }
      const next = direction === 'next' ? Math.min(idx + 1, sorted.length - 1) : Math.max(idx - 1, 0);
      return { selectedSegmentId: sorted[next].id };
    }),

  splitSegment: (id, atTime) =>
    set((state) => {
      const seg = state.segments.find((s) => s.id === id);
      if (!seg || !canSplitAt(seg, atTime)) {
        return state;
      }
      const left: Annotation = { ...seg, end: atTime - SPLIT_GAP };
      const right: Annotation = { ...seg, id: crypto.randomUUID(), start: atTime + SPLIT_GAP, value: '' };
      return {
        segments: state.segments.flatMap((s) => (s.id === id ? [left, right] : [s])),
        selectedSegmentId: right.id,
      };
    }),

  deleteSegment: (id) =>
    set((state) => ({
      segments: state.segments.filter((s) => s.id !== id),
      selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
    })),

  mergeWithNext: (id) =>
    set((state) => {
      const sorted = sortByStart(state.segments);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx === -1 || idx >= sorted.length - 1) {
        return state;
      }
      const current = sorted[idx];
      const next = sorted[idx + 1];
      const merged: Annotation = { ...current, end: next.end };
      return {
        segments: state.segments.flatMap((s) => {
          if (s.id === id) {
            return [merged];
          }
          if (s.id === next.id) {
            return [];
          }
          return [s];
        }),
        selectedSegmentId: id,
      };
    }),

  mergeWithPrevious: (id) =>
    set((state) => {
      const sorted = sortByStart(state.segments);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx <= 0) {
        return state;
      }
      const current = sorted[idx];
      const prev = sorted[idx - 1];
      const merged: Annotation = { ...prev, end: current.end };
      return {
        segments: state.segments.flatMap((s) => {
          if (s.id === prev.id) {
            return [merged];
          }
          if (s.id === id) {
            return [];
          }
          return [s];
        }),
        selectedSegmentId: prev.id,
      };
    }),

  createSegment: (start, end, speakerIndex) => {
    const id = crypto.randomUUID();
    set((state) => ({
      segments: [...state.segments, { end, id, speaker: speakerIndex, start, value: '' }],
      selectedSegmentId: id,
    }));
    return id;
  },

  clearSegments: () => set({ segments: [], selectedSegmentId: null }),

  assignSpeaker: (segmentId, speakerIndex) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === segmentId ? { ...s, speaker: speakerIndex } : s)),
    })),

  assignAllToSpeaker: (speakerIndex) =>
    set((state) => ({
      segments: state.segments.map((s) => ({ ...s, speaker: speakerIndex })),
    })),

  setSpeakerCount: (count) => {
    const clamped = Math.max(1, Math.min(MAX_SPEAKERS, count));
    set((state) => {
      const names = [...state.speakerNames];
      while (names.length < clamped) {
        names.push(`Speaker ${names.length + 1}`);
      }
      if (names.length > clamped) {
        names.length = clamped;
      }
      const lastValid = clamped - 1;
      const segments = state.segments.map((s) => (s.speaker >= clamped ? { ...s, speaker: lastValid } : s));
      const defaultSpeaker = state.defaultSpeaker >= clamped ? lastValid : state.defaultSpeaker;
      return { defaultSpeaker, segments, speakerNames: names };
    });
  },

  setSpeakerName: (index, name) =>
    set((state) => {
      if (index < 0 || index >= state.speakerNames.length) {
        return state;
      }
      const names = [...state.speakerNames];
      names[index] = name;
      return { speakerNames: names };
    }),

  setDefaultSpeaker: (index) =>
    set((state) => {
      if (index < 0 || index >= state.speakerNames.length) {
        return state;
      }
      return { defaultSpeaker: index };
    }),

  setVadConfig: (config) =>
    set((state) => ({
      vadConfig: { ...state.vadConfig, ...config },
    })),

  reset: () => set(initialState),
}));
