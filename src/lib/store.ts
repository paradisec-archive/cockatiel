import { create } from 'zustand';
import { DEFAULT_VAD_CONFIG, MAX_SPEAKERS } from './constants';
import { deleteSession } from './persistence/storage';
import type { StoredSession } from './persistence/types';
import type { Annotation, SegmentCtx } from './segment-ops';
import { SegmentInspect, SegmentOps } from './segment-ops';
import type { VadConfig, VadSegment } from './vad';

type AppPhase = 'workbench' | 'upload' | 'processing' | 'ready';

interface AppState {
  appPhase: AppPhase;
  defaultSpeaker: number;
  fileHandle: FileSystemFileHandle | null;
  fingerprint: string;
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
  createSegment: (start: number, end: number, speakerIndex: number) => string | null;
  deleteSegment: (id: string) => void;
  discardSession: (fingerprint: string) => Promise<void>;
  hydrateFromStoredSession: (session: StoredSession) => void;
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
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  setFingerprint: (fingerprint: string) => void;
  setMediaFile: (name: string, duration: number) => void;
  setProgress: (fraction: number) => void;
  setSpeakerCount: (count: number) => void;
  setSpeakerName: (index: number, name: string) => void;
  setStatus: (message: string) => void;
  setVadConfig: (config: Partial<VadConfig>) => void;
  updateSegmentBounds: (id: string, start: number, end: number) => void;
  updateSegmentText: (id: string, value: string) => void;
}

const makeCtx = (state: AppState): SegmentCtx => ({
  defaultSpeaker: state.defaultSpeaker,
  mediaDuration: state.mediaDuration,
  newId: () => crypto.randomUUID(),
  speakerCount: state.speakerNames.length,
});

const initialState = {
  appPhase: 'workbench' as AppPhase,
  defaultSpeaker: 0,
  fileHandle: null as FileSystemFileHandle | null,
  fingerprint: '',
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
  setFileHandle: (fileHandle) => set({ fileHandle }),
  setFingerprint: (fingerprint) => set({ fingerprint }),
  setStatus: (message) => set({ statusMessage: message }),
  setProgress: (fraction) => set({ processingProgress: fraction }),

  hydrateFromStoredSession: (session) =>
    set({
      fileHandle: session.fileHandle ?? null,
      fingerprint: session.fingerprint,
      mediaDuration: session.mediaDuration,
      mediaFileName: session.mediaFileName,
      segments: session.segments,
      speakerNames: session.speakerNames,
      vadConfig: session.vadConfig,
    }),

  discardSession: async (fingerprint) => {
    const wasLoaded = get().fingerprint === fingerprint;
    await deleteSession(fingerprint);
    if (wasLoaded && get().fingerprint === fingerprint) {
      set(initialState);
    }
  },

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

  updateSegmentBounds: (id, start, end) => set((state) => SegmentOps.rebound(state, id, start, end, makeCtx(state))),

  updateSegmentText: (id, value) =>
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? { ...s, value } : s)),
    })),

  selectSegment: (id) => set({ selectedSegmentId: id }),

  setLoopOnSelect: (value) => set({ loopOnSelect: value }),

  selectAdjacentSegment: (direction) =>
    set((state) => {
      const sorted = SegmentInspect.sortedByStart(state.segments);
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

  splitSegment: (id, atTime) => set((state) => SegmentOps.split(state, id, atTime, makeCtx(state))),

  deleteSegment: (id) => set((state) => SegmentOps.remove(state, id)),

  mergeWithNext: (id) => set((state) => SegmentOps.mergeNext(state, id)),

  mergeWithPrevious: (id) => set((state) => SegmentOps.mergePrev(state, id)),

  createSegment: (start, end, speakerIndex) => {
    const state = get();
    const next = SegmentOps.create(state, start, end, speakerIndex, makeCtx(state));
    if (next === state) {
      return null;
    }
    set(next);
    return next.selectedSegmentId;
  },

  clearSegments: () => set({ segments: [], selectedSegmentId: null }),

  assignSpeaker: (segmentId, speakerIndex) => set((state) => SegmentOps.assignSpeaker(state, segmentId, speakerIndex, makeCtx(state))),

  assignAllToSpeaker: (speakerIndex) => set((state) => SegmentOps.assignAll(state, speakerIndex, makeCtx(state))),

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
      const reconciled = SegmentOps.reconcileSpeakers(state, clamped);
      const defaultSpeaker = state.defaultSpeaker >= clamped ? clamped - 1 : state.defaultSpeaker;
      return { defaultSpeaker, segments: reconciled.segments, speakerNames: names };
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
