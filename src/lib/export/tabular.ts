import { getSpeakerName } from '../constants';
import type { Annotation } from '../store';
import type { ExportData } from './types';

export { formatTime } from '../constants';

export const formatSeconds3dp = (n: number): string => n.toFixed(3);

export const formatHhmmssMmm = (seconds: number): string => {
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

export const escapeCsv = (text: string): string => {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const escapeTextGridQuotes = (text: string): string => text.replace(/"/g, '""');

interface RowContext {
  esc: (s: string) => string;
  index: number;
  seg: Annotation;
  speakerName: string;
  time: (s: number) => string;
}

interface TabularConfig {
  esc?: (s: string) => string;
  header?: string;
  row: (ctx: RowContext) => string;
  separator?: string;
  time: (s: number) => string;
}

const identity = (s: string): string => s;

export const tabular = (data: ExportData, cfg: TabularConfig): string => {
  const esc = cfg.esc ?? identity;
  const sep = cfg.separator ?? '\n';
  const rows: string[] = cfg.header !== undefined ? [cfg.header] : [];

  data.segments.forEach((seg, i) => {
    rows.push(
      cfg.row({
        esc,
        index: i + 1,
        seg,
        speakerName: getSpeakerName(data.speakerNames, seg.speaker),
        time: cfg.time,
      }),
    );
  });

  return rows.join(sep);
};
