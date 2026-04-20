import { useCallback } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { downloadExport, type ExportFormatId, listExportFormats, renderExport } from '@/lib/export';
import { useAppStore } from '@/lib/store';

const EXPORT_FORMATS = listExportFormats();

const baseName = (fileName: string): string => {
  return fileName.replace(/\.[^.]+$/, '') || 'transcription';
};

const getExportData = () => {
  const { mediaDuration, mediaFileName, segments, speakerNames } = useAppStore.getState();
  return { mediaDuration, mediaFileName, segments, speakerNames };
};

export const ExportMenu = () => {
  const mediaFileName = useAppStore((s) => s.mediaFileName);
  const hasSegments = useAppStore((s) => s.segments.length > 0);
  const base = baseName(mediaFileName);

  const handleExport = useCallback(
    (id: ExportFormatId) => {
      const payload = renderExport(id, getExportData());
      downloadExport(`${base}${payload.ext}`, payload);
    },
    [base],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground shadow-xs hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        disabled={!hasSegments}
      >
        Export ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {EXPORT_FORMATS.map((format) => (
          <DropdownMenuItem key={format.id} onClick={() => handleExport(format.id)} className="whitespace-nowrap">
            <span className="w-20 text-right font-mono text-xs text-muted-foreground">{format.ext}</span>
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
