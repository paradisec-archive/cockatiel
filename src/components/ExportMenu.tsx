import { useCallback } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { generateCsv } from '@/lib/export/csv-export';
import { downloadFile } from '@/lib/export/download';
import { generateEaf } from '@/lib/export/eaf-export';
import { generateSrt } from '@/lib/export/srt-export';
import { generateText } from '@/lib/export/text-export';
import { generateTextGrid } from '@/lib/export/textgrid-export';
import type { ExportData } from '@/lib/export/types';
import { useAppStore } from '@/lib/store';

const exportFormats = [
  { ext: '.eaf', generate: generateEaf, label: 'ELAN XML', mime: 'application/xml' },
  { ext: '.srt', generate: generateSrt, label: 'SRT Subtitles', mime: 'text/plain' },
  { ext: '.TextGrid', generate: generateTextGrid, label: 'Praat TextGrid', mime: 'text/plain' },
  { ext: '.csv', generate: generateCsv, label: 'CSV', mime: 'text/csv' },
  { ext: '.txt', generate: generateText, label: 'Plain Text', mime: 'text/plain' },
] as const;

const getExportData = (): ExportData => {
  const { mediaDuration, mediaFileName, segments, speakerNames } = useAppStore.getState();
  return { mediaDuration, mediaFileName, segments, speakerNames };
};

const baseName = (fileName: string): string => {
  return fileName.replace(/\.[^.]+$/, '') || 'transcription';
};

export const ExportMenu = () => {
  const mediaFileName = useAppStore((s) => s.mediaFileName);
  const hasSegments = useAppStore((s) => s.segments.length > 0);
  const base = baseName(mediaFileName);

  const handleExport = useCallback(
    (format: (typeof exportFormats)[number]) => {
      downloadFile(format.generate(getExportData()), `${base}${format.ext}`, format.mime);
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
      <DropdownMenuContent align="end">
        {exportFormats.map((format) => (
          <DropdownMenuItem key={format.ext} onClick={() => handleExport(format)}>
            <span className="mr-2 font-mono text-xs text-muted-foreground">{format.ext}</span>
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
