import type { VadConfig } from './vad-processor';

const SPEAKER_COLOURS = ['#e11d48', '#06b6d4', '#f59e0b', '#8b5cf6', '#10b981', '#f97316', '#3b82f6', '#ec4899'];

export const MAX_SPEAKERS = SPEAKER_COLOURS.length;

export const getSpeakerColour = (index: number): string => {
  return SPEAKER_COLOURS[index % SPEAKER_COLOURS.length];
};

export const getSpeakerName = (speakerNames: string[], index: number): string => {
  return speakerNames[index] ?? `Speaker ${index + 1}`;
};

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

export const SAMPLE_RATE_16K = 16000;

export const DEFAULT_VAD_CONFIG: VadConfig = {
  maxSpeechDuration: 30,
  minSilenceDuration: 0.3,
  minSpeechDuration: 0.25,
  threshold: 0.5,
};
