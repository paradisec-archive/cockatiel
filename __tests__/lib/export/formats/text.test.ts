import { describe, expect, it } from 'vitest';
import { text } from '@/lib/export/formats/text';
import type { ExportData } from '@/lib/export/types';

const data: ExportData = {
  mediaDuration: 70,
  mediaFileName: 'test.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello world' },
    { end: 65.7, id: 'a2', speaker: 1, start: 60.5, value: 'goodbye world' },
  ],
  speakerNames: ['Alice', 'Bob'],
  title: 'test',
};

describe('text exporter', () => {
  it('emits "[mm:ss.s - mm:ss.s] Name: value" lines joined by newlines', () => {
    const out = text.generate(data);
    expect(out).toBe(['[0:00.0 - 0:02.5] Alice: hello world', '[1:00.5 - 1:05.7] Bob: goodbye world'].join('\n'));
  });
});
