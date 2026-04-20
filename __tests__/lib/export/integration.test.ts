import { describe, expect, it } from 'vitest';
import { type ExportFormatId, listExportFormats, renderExport } from '@/lib/export';
import type { ExportData } from '@/lib/export/types';

const data: ExportData = {
  mediaDuration: 10,
  mediaFileName: 'recording.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello world' },
    { end: 5.0, id: 'a2', speaker: 1, start: 3.0, value: 'goodbye' },
  ],
  speakerNames: ['Alice', 'Bob'],
};

const expected: Record<ExportFormatId, { ext: string; mime: string }> = {
  csv: { ext: '.csv', mime: 'text/csv' },
  eaf: { ext: '.eaf', mime: 'application/xml' },
  srt: { ext: '.srt', mime: 'text/plain' },
  text: { ext: '.txt', mime: 'text/plain' },
  textgrid: { ext: '.TextGrid', mime: 'text/plain' },
};

describe('renderExport', () => {
  it('lists all five formats in dropdown order', () => {
    const ids = listExportFormats().map((f) => f.id);
    expect(ids).toEqual(['eaf', 'srt', 'textgrid', 'csv', 'text']);
  });

  it('listExportFormats omits the mime field from the public surface', () => {
    const sample = listExportFormats()[0];
    expect(Object.keys(sample).sort()).toEqual(['ext', 'id', 'label']);
  });

  for (const id of Object.keys(expected) as ExportFormatId[]) {
    it(`renders a ${id} payload with the right ext and mime`, () => {
      const payload = renderExport(id, data);
      expect(payload.ext).toBe(expected[id].ext);
      expect(payload.mime).toBe(expected[id].mime);
      expect(typeof payload.content).toBe('string');
      expect(payload.content.length).toBeGreaterThan(0);
    });
  }

  it('throws for an unknown format id', () => {
    expect(() => renderExport('bogus' as ExportFormatId, data)).toThrow(/Unknown export format/);
  });
});
