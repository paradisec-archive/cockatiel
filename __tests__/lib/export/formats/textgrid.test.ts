import { describe, expect, it } from 'vitest';
import { textgrid } from '@/lib/export/formats/textgrid';
import type { ExportData } from '@/lib/export/types';

describe('textgrid exporter', () => {
  it('emits a two-tier header with the correct duration', () => {
    const data: ExportData = {
      mediaDuration: 10,
      mediaFileName: 'test.wav',
      segments: [{ end: 2, id: 'a1', speaker: 0, start: 0, value: 'hello' }],
      speakerNames: ['Alice'],
      title: 'test',
    };
    const out = textgrid.generate(data);
    expect(out).toContain('File type = "ooTextFile"');
    expect(out).toContain('Object class = "TextGrid"');
    expect(out).toContain('xmax = 10');
    expect(out).toContain('size = 2');
  });

  it('fills silence gaps with empty intervals on both tiers', () => {
    const data: ExportData = {
      mediaDuration: 10,
      mediaFileName: 'test.wav',
      segments: [
        { end: 2, id: 'a1', speaker: 0, start: 1, value: 'hello' },
        { end: 6, id: 'a2', speaker: 0, start: 4, value: 'world' },
      ],
      speakerNames: ['Alice'],
      title: 'test',
    };
    const out = textgrid.generate(data);
    expect(out.match(/intervals: size = 5/g)).toHaveLength(2);
    expect(out).toContain('text = "hello"');
    expect(out).toContain('text = "world"');
    expect(out).toContain('text = "Alice"');
  });

  it('escapes embedded quotes by doubling', () => {
    const data: ExportData = {
      mediaDuration: 5,
      mediaFileName: 'test.wav',
      segments: [{ end: 2, id: 'a1', speaker: 0, start: 0, value: 'say "hi"' }],
      speakerNames: ['Alice'],
      title: 'test',
    };
    const out = textgrid.generate(data);
    expect(out).toContain('text = "say ""hi"""');
  });
});
