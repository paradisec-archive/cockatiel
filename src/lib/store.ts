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
  loadSegments: (segments: VadSegment[]) => void;
  reset: () => void;
  selectSegment: (id: string | null) => void;
  setAppPhase: (phase: AppPhase) => void;
  setDefaultSpeaker: (index: number) => void;
  setMediaFile: (name: string, duration: number) => void;
  setProgress: (fraction: number) => void;
  setSpeakerCount: (count: number) => void;
  setSpeakerName: (index: number, name: string) => void;
  setStatus: (message: string) => void;
  setVadConfig: (config: Partial<VadConfig>) => void;
  updateSegmentText: (id: string, value: string) => void;
}

const initialState = {
  appPhase: 'upload' as AppPhase,
  defaultSpeaker: 0,
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

  updateSegmentText: (id, value) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? { ...s, value } : s)),
    })),

  selectSegment: (id) => set({ selectedSegmentId: id }),
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
      if (index < 0 || index >= state.speakerNames.length) return state;
      const names = [...state.speakerNames];
      names[index] = name;
      return { speakerNames: names };
    }),

  setDefaultSpeaker: (index) =>
    set((state) => {
      if (index < 0 || index >= state.speakerNames.length) return state;
      return { defaultSpeaker: index };
    }),

  setVadConfig: (config) =>
    set((state) => ({
      vadConfig: { ...state.vadConfig, ...config },
    })),

  reset: () => set(initialState),
}));
