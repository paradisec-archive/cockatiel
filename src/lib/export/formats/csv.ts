import { escapeCsv, formatSeconds3dp, tabular } from '../tabular';
import type { ExportData, Exporter } from '../types';

const generate = (data: ExportData): string =>
  tabular(data, {
    esc: escapeCsv,
    header: 'Start,End,Speaker,Text',
    row: ({ esc, seg, speakerName, time }) => `${time(seg.start)},${time(seg.end)},${esc(speakerName)},${esc(seg.value)}`,
    time: formatSeconds3dp,
  });

export const csv: Exporter = {
  id: 'csv',
  label: 'CSV',
  ext: '.csv',
  mime: 'text/csv',
  generate,
};
