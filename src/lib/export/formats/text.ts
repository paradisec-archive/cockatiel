import { formatTime, tabular } from '../tabular';
import type { ExportData, Exporter } from '../types';

const generate = (data: ExportData): string =>
  tabular(data, {
    row: ({ seg, speakerName, time }) => `[${time(seg.start)} - ${time(seg.end)}] ${speakerName}: ${seg.value}`,
    time: formatTime,
  });

export const text: Exporter = {
  id: 'text',
  label: 'Plain Text',
  ext: '.txt',
  mime: 'text/plain',
  generate,
};
