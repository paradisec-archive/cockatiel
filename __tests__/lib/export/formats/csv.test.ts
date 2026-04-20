import { describe, expect, it } from 'vitest';
import { csv } from '@/lib/export/formats/csv';
import type { ExportData } from '@/lib/export/types';

const data: ExportData = {
  mediaDuration: 10,
  mediaFileName: 'test.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello world' },
    { end: 5.0, id: 'a2', speaker: 1, start: 3.0, value: 'goodbye, "world"' },
  ],
  speakerNames: ['Alice', 'Bob'],
};

describe('csv exporter', () => {
  it('generates header and rows in the expected shape', () => {
    const out = csv.generate(data);
    const lines = out.split('\n');

    expect(lines[0]).toBe('Start,End,Speaker,Text');
    expect(lines[1]).toBe('0.000,2.500,Alice,hello world');
    expect(lines[2]).toBe('3.000,5.000,Bob,"goodbye, ""world"""');
  });
});
