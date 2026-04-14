import { formatTime, getSpeakerName } from '../constants';
import type { ExportData } from './types';

export const generateText = (data: ExportData): string => {
  return data.segments
    .map((seg) => {
      const name = getSpeakerName(data.speakerNames, seg.speaker);
      const time = `[${formatTime(seg.start)} - ${formatTime(seg.end)}]`;
      return `${time} ${name}: ${seg.value}`;
    })
    .join('\n');
};
