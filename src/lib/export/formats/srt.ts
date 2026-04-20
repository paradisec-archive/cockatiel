import { formatHhmmssMmm, tabular } from '../tabular';
import type { ExportData, Exporter } from '../types';

const generate = (data: ExportData): string =>
  tabular(data, {
    row: ({ index, seg, speakerName, time }) => `${index}\n${time(seg.start)} --> ${time(seg.end)}\n[${speakerName}] ${seg.value || '...'}`,
    separator: '\n\n',
    time: formatHhmmssMmm,
  });

export const srt: Exporter = {
  id: 'srt',
  label: 'SRT Subtitles',
  ext: '.srt',
  mime: 'text/plain',
  generate,
};
