import { getSpeakerName } from '../constants';
import type { ExportData } from './types';

const escapeCsv = (text: string): string => {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const generateCsv = (data: ExportData): string => {
  const rows: string[] = ['Start,End,Speaker,Text'];

  for (const seg of data.segments) {
    const speakerName = getSpeakerName(data.speakerNames, seg.speaker);
    rows.push(`${seg.start.toFixed(3)},${seg.end.toFixed(3)},${escapeCsv(speakerName)},${escapeCsv(seg.value)}`);
  }

  return rows.join('\n');
};
