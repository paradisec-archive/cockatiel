import { getSpeakerName } from '../../constants';
import type { Annotation } from '../../segment-ops';
import { escapeTextGridQuotes } from '../tabular';
import type { ExportData, Exporter } from '../types';

interface Interval {
  text: string;
  xmax: number;
  xmin: number;
}

const buildIntervals = (data: ExportData, textFn: (seg: Annotation) => string): Interval[] => {
  const intervals: Interval[] = [];
  let cursor = 0;

  for (const seg of data.segments) {
    if (seg.start > cursor) {
      intervals.push({ text: '', xmax: seg.start, xmin: cursor });
    }
    intervals.push({ text: textFn(seg), xmax: seg.end, xmin: seg.start });
    cursor = seg.end;
  }

  if (cursor < data.mediaDuration) {
    intervals.push({ text: '', xmax: data.mediaDuration, xmin: cursor });
  }

  return intervals;
};

const writeIntervalTier = (lines: string[], name: string, intervals: Interval[], duration: number): void => {
  lines.push(`        class = "IntervalTier"`);
  lines.push(`        name = "${name}"`);
  lines.push(`        xmin = 0`);
  lines.push(`        xmax = ${duration}`);
  lines.push(`        intervals: size = ${intervals.length}`);

  for (let i = 0; i < intervals.length; i++) {
    const iv = intervals[i];
    lines.push(`        intervals [${i + 1}]:`);
    lines.push(`            xmin = ${iv.xmin}`);
    lines.push(`            xmax = ${iv.xmax}`);
    lines.push(`            text = "${escapeTextGridQuotes(iv.text)}"`);
  }
};

const generate = (data: ExportData): string => {
  const transcriptIntervals = buildIntervals(data, (seg) => seg.value);
  const speakerIntervals = buildIntervals(data, (seg) => getSpeakerName(data.speakerNames, seg.speaker));

  const lines: string[] = [];
  lines.push('File type = "ooTextFile"');
  lines.push('Object class = "TextGrid"');
  lines.push('');
  lines.push('xmin = 0');
  lines.push(`xmax = ${data.mediaDuration}`);
  lines.push('tiers? <exists>');
  lines.push('size = 2');
  lines.push('item []:');

  lines.push('    item [1]:');
  writeIntervalTier(lines, 'Transcription', transcriptIntervals, data.mediaDuration);

  lines.push('    item [2]:');
  writeIntervalTier(lines, 'Speaker', speakerIntervals, data.mediaDuration);

  return lines.join('\n');
};

export const textgrid: Exporter = {
  id: 'textgrid',
  label: 'Praat TextGrid',
  ext: '.TextGrid',
  mime: 'text/plain',
  generate,
};
