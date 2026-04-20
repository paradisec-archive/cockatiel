import type { Annotation } from '../store';

export interface ExportData {
  mediaDuration: number;
  mediaFileName: string;
  segments: Annotation[];
  speakerNames: string[];
}

export type ExportFormatId = 'eaf' | 'srt' | 'textgrid' | 'csv' | 'text';

export interface Exporter {
  id: ExportFormatId;
  label: string;
  ext: string;
  mime: string;
  generate: (data: ExportData) => string;
}
