import type { Annotation } from '../store';

/** Common shape passed to all export functions. */
export interface ExportData {
  mediaDuration: number;
  mediaFileName: string;
  segments: Annotation[];
  speakerNames: string[];
}
