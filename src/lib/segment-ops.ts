export interface Annotation {
  end: number;
  id: string;
  speaker: number;
  start: number;
  value: string;
}

export interface SegmentState {
  segments: Annotation[];
  selectedSegmentId: string | null;
}

export interface InspectCtx {
  defaultSpeaker: number;
  mediaDuration: number;
  speakerCount: number;
}

export interface SegmentCtx extends InspectCtx {
  newId: () => string;
}

type Rejection =
  | 'below-min-duration'
  | 'invalid-speaker'
  | 'no-neighbour-next'
  | 'no-neighbour-prev'
  | 'no-room'
  | 'not-found'
  | 'out-of-bounds'
  | 'split-too-close-to-edge'
  | 'would-overlap';

export const SPLIT_GAP = 0.05;
export const MIN_DURATION = 0.05;
const NEW_SEGMENT_DURATION = 1.0;

const sortedByStart = (segments: Annotation[]) => [...segments].sort((a, b) => a.start - b.start);

const findAtTime = (segments: Annotation[], time: number) => segments.find((s) => time >= s.start && time <= s.end);

const nearestSpeaker = (segments: Annotation[], time: number, fallback: number) => {
  if (!segments.length) {
    return fallback;
  }

  let nearest = segments[0];
  let nearestDist = Math.abs(time - (nearest.start + nearest.end) / 2);

  for (const seg of segments) {
    const dist = Math.abs(time - (seg.start + seg.end) / 2);
    if (dist < nearestDist) {
      nearest = seg;
      nearestDist = dist;
    }
  }

  return nearest.speaker;
};

const proposedBoundsAt = (segments: Annotation[], time: number, mediaDuration: number): { end: number; start: number } | null => {
  if (time < 0 || time > mediaDuration) {
    return null;
  }

  // Time inside an existing segment → no room for a new one here.
  if (segments.some((s) => time >= s.start && time <= s.end)) {
    return null;
  }

  const half = NEW_SEGMENT_DURATION / 2;
  let start = Math.max(0, time - half);
  let end = Math.min(mediaDuration, time + half);
  for (const seg of segments) {
    if (seg.end <= time && seg.end > start) {
      start = seg.end;
    }
    if (seg.start >= time && seg.start < end) {
      end = seg.start;
    }
  }

  if (end - start < MIN_DURATION) {
    return null;
  }

  return { end, start };
};

const overlapsAny = (segments: Annotation[], start: number, end: number, excludeId?: string) =>
  segments.some((s) => s.id !== excludeId && s.start < end && s.end > start);

const validateSplit = (state: SegmentState, id: string, atTime: number): Rejection | null => {
  const seg = state.segments.find((s) => s.id === id);
  if (!seg) {
    return 'not-found';
  }

  if (atTime <= seg.start + SPLIT_GAP || atTime >= seg.end - SPLIT_GAP) {
    return 'split-too-close-to-edge';
  }

  return null;
};

const validateMergeNext = (state: SegmentState, id: string): Rejection | null => {
  if (!state.segments.some((s) => s.id === id)) {
    return 'not-found';
  }

  const sorted = sortedByStart(state.segments);
  const idx = sorted.findIndex((s) => s.id === id);
  if (idx >= sorted.length - 1) {
    return 'no-neighbour-next';
  }

  return null;
};

const validateMergePrev = (state: SegmentState, id: string): Rejection | null => {
  if (!state.segments.some((s) => s.id === id)) {
    return 'not-found';
  }

  const sorted = sortedByStart(state.segments);
  const idx = sorted.findIndex((s) => s.id === id);
  if (idx <= 0) {
    return 'no-neighbour-prev';
  }

  return null;
};

const validateRemove = (state: SegmentState, id: string): Rejection | null => {
  if (!state.segments.some((s) => s.id === id)) {
    return 'not-found';
  }

  return null;
};

const validateCreate = (state: SegmentState, start: number, end: number, speaker: number, ctx: InspectCtx): Rejection | null => {
  if (start < 0 || end > ctx.mediaDuration) {
    return 'out-of-bounds';
  }

  if (end - start < MIN_DURATION) {
    return 'below-min-duration';
  }

  if (speaker < 0 || speaker >= ctx.speakerCount) {
    return 'invalid-speaker';
  }

  if (overlapsAny(state.segments, start, end)) {
    return 'would-overlap';
  }

  return null;
};

const validateCreateAt = (state: SegmentState, time: number, ctx: InspectCtx): Rejection | null => {
  const bounds = proposedBoundsAt(state.segments, time, ctx.mediaDuration);
  if (!bounds) {
    return 'no-room';
  }

  const speaker = nearestSpeaker(state.segments, time, ctx.defaultSpeaker);

  return validateCreate(state, bounds.start, bounds.end, speaker, ctx);
};

const validateRebound = (state: SegmentState, id: string, start: number, end: number, ctx: InspectCtx): Rejection | null => {
  if (!state.segments.some((s) => s.id === id)) {
    return 'not-found';
  }

  if (start < 0 || end > ctx.mediaDuration) {
    return 'out-of-bounds';
  }

  if (end - start < MIN_DURATION) {
    return 'below-min-duration';
  }

  if (overlapsAny(state.segments, start, end, id)) {
    return 'would-overlap';
  }

  return null;
};

const validateAssignSpeaker = (state: SegmentState, id: string, speaker: number, ctx: InspectCtx): Rejection | null => {
  if (!state.segments.some((s) => s.id === id)) {
    return 'not-found';
  }

  if (speaker < 0 || speaker >= ctx.speakerCount) {
    return 'invalid-speaker';
  }

  return null;
};

const validateAssignAll = (_state: SegmentState, speaker: number, ctx: InspectCtx): Rejection | null => {
  if (speaker < 0 || speaker >= ctx.speakerCount) {
    return 'invalid-speaker';
  }

  return null;
};

const split = (state: SegmentState, id: string, atTime: number, ctx: SegmentCtx): SegmentState => {
  if (validateSplit(state, id, atTime) !== null) {
    return state;
  }

  const seg = state.segments.find((s) => s.id === id) as Annotation;
  const left: Annotation = { ...seg, end: atTime - SPLIT_GAP };
  const right: Annotation = { ...seg, id: ctx.newId(), start: atTime + SPLIT_GAP, value: '' };

  return {
    segments: state.segments.flatMap((s) => (s.id === id ? [left, right] : [s])),
    selectedSegmentId: right.id,
  };
};

const mergeNext = (state: SegmentState, id: string): SegmentState => {
  if (validateMergeNext(state, id) !== null) {
    return state;
  }

  const sorted = sortedByStart(state.segments);
  const idx = sorted.findIndex((s) => s.id === id);
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
};

const mergePrev = (state: SegmentState, id: string): SegmentState => {
  if (validateMergePrev(state, id) !== null) {
    return state;
  }

  const sorted = sortedByStart(state.segments);
  const idx = sorted.findIndex((s) => s.id === id);
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
};

const remove = (state: SegmentState, id: string): SegmentState => {
  if (validateRemove(state, id) !== null) {
    return state;
  }

  return {
    segments: state.segments.filter((s) => s.id !== id),
    selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
  };
};

const create = (state: SegmentState, start: number, end: number, speaker: number, ctx: SegmentCtx): SegmentState => {
  if (validateCreate(state, start, end, speaker, ctx) !== null) {
    return state;
  }

  const id = ctx.newId();
  return {
    segments: [...state.segments, { end, id, speaker, start, value: '' }],
    selectedSegmentId: id,
  };
};

const createAt = (state: SegmentState, time: number, ctx: SegmentCtx): SegmentState => {
  const bounds = proposedBoundsAt(state.segments, time, ctx.mediaDuration);
  if (!bounds) {
    return state;
  }

  const speaker = nearestSpeaker(state.segments, time, ctx.defaultSpeaker);

  return create(state, bounds.start, bounds.end, speaker, ctx);
};

const rebound = (state: SegmentState, id: string, start: number, end: number, ctx: SegmentCtx): SegmentState => {
  if (validateRebound(state, id, start, end, ctx) !== null) {
    return state;
  }

  return {
    segments: state.segments.map((s) => (s.id === id ? { ...s, end, start } : s)),
    selectedSegmentId: state.selectedSegmentId,
  };
};

const assignSpeaker = (state: SegmentState, id: string, speaker: number, ctx: SegmentCtx): SegmentState => {
  if (validateAssignSpeaker(state, id, speaker, ctx) !== null) {
    return state;
  }

  return {
    segments: state.segments.map((s) => (s.id === id ? { ...s, speaker } : s)),
    selectedSegmentId: state.selectedSegmentId,
  };
};

const assignAll = (state: SegmentState, speaker: number, ctx: SegmentCtx): SegmentState => {
  if (validateAssignAll(state, speaker, ctx) !== null) {
    return state;
  }

  return {
    segments: state.segments.map((s) => ({ ...s, speaker })),
    selectedSegmentId: state.selectedSegmentId,
  };
};

const reconcileSpeakers = (state: SegmentState, newCount: number): SegmentState => {
  const lastValid = Math.max(0, newCount - 1);
  let changed = false;
  const segments = state.segments.map((s) => {
    if (s.speaker >= newCount) {
      changed = true;

      return { ...s, speaker: lastValid };
    }

    return s;
  });

  if (!changed) {
    return state;
  }

  return { segments, selectedSegmentId: state.selectedSegmentId };
};

export const SegmentOps = {
  assignAll,
  assignSpeaker,
  create,
  createAt,
  mergeNext,
  mergePrev,
  rebound,
  reconcileSpeakers,
  remove,
  split,
};

export const SegmentInspect = {
  assignAll: validateAssignAll,
  assignSpeaker: validateAssignSpeaker,
  create: validateCreate,
  createAt: validateCreateAt,
  findAtTime,
  mergeNext: validateMergeNext,
  mergePrev: validateMergePrev,
  nearestSpeaker,
  proposedBoundsAt,
  rebound: validateRebound,
  remove: validateRemove,
  sortedByStart,
  split: validateSplit,
};

const REJECTION_MESSAGES: Record<Rejection, string> = {
  'below-min-duration': 'Segment would be too short',
  'invalid-speaker': 'Invalid speaker',
  'no-neighbour-next': 'No following segment to merge with',
  'no-neighbour-prev': 'No preceding segment to merge with',
  'no-room': 'Not enough space here for a new segment',
  'not-found': 'Segment not found',
  'out-of-bounds': 'Segment extends past media boundaries',
  'split-too-close-to-edge': 'Click further inside the segment to split it',
  'would-overlap': 'Would overlap neighbouring segment',
};

export const rejectionMessage = (r: Rejection) => REJECTION_MESSAGES[r];
