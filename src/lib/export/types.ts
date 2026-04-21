import type { Annotation } from '../segment-ops';

export interface ExportData {
  mediaDuration: number;
  mediaFileName: string;
  segments: Annotation[];
  speakerNames: string[];
  title: string;
}

export type ExportFormatId = 'eaf' | 'srt' | 'textgrid' | 'csv' | 'text';

export interface Exporter {
  id: ExportFormatId;
  label: string;
  ext: string;
  mime: string;
  generate: (data: ExportData) => string;
}
