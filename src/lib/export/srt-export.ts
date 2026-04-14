import { getSpeakerName } from '../constants';
import type { ExportData } from './types';

const formatSrtTime = (seconds: number): string => {
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

export const generateSrt = (data: ExportData): string => {
  return data.segments
    .map((ann, i) => {
      const name = getSpeakerName(data.speakerNames, ann.speaker);
      const text = ann.value || '...';
      return `${i + 1}\n${formatSrtTime(ann.start)} --> ${formatSrtTime(ann.end)}\n[${name}] ${text}`;
    })
    .join('\n\n');
};
