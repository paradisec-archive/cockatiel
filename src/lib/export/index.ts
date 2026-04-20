import { ALL_EXPORTERS } from './formats';
import type { ExportData, ExportFormatId } from './types';

interface ExportFormatInfo {
  ext: string;
  id: ExportFormatId;
  label: string;
}

interface ExportPayload {
  content: string;
  ext: string;
  mime: string;
}

const REGISTRY = new Map(ALL_EXPORTERS.map((e) => [e.id, e] as const));

export const listExportFormats = (): readonly ExportFormatInfo[] => ALL_EXPORTERS.map(({ ext, id, label }) => ({ ext, id, label }));

export const renderExport = (id: ExportFormatId, data: ExportData): ExportPayload => {
  const exp = REGISTRY.get(id);

  if (!exp) {
    throw new Error(`Unknown export format: ${id}`);
  }

  return { content: exp.generate(data), ext: exp.ext, mime: exp.mime };
};

export const downloadExport = (filename: string, { content, mime }: { content: string; mime: string }): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
};

export type { ExportFormatId } from './types';
