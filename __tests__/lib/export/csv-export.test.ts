import { describe, expect, it } from 'vitest';
import { generateCsv } from '@/lib/export/csv-export';
import type { ExportData } from '@/lib/export/types';

const testData: ExportData = {
  mediaDuration: 10,
  mediaFileName: 'test.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello world' },
    { end: 5.0, id: 'a2', speaker: 1, start: 3.0, value: 'goodbye, "world"' },
  ],
  speakerNames: ['Alice', 'Bob'],
};

describe('generateCsv', () => {
  it('generates CSV with header and rows', () => {
    const csv = generateCsv(testData);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Start,End,Speaker,Text');
    expect(lines[1]).toBe('0.000,2.500,Alice,hello world');
  });

  it('escapes values containing commas or quotes', () => {
    const csv = generateCsv(testData);
    const lines = csv.split('\n');

    // "goodbye, "world"" should be escaped
    expect(lines[2]).toContain('"goodbye, ""world"""');
  });
});
