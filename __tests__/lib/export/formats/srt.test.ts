import { describe, expect, it } from 'vitest';
import { srt } from '@/lib/export/formats/srt';
import type { ExportData } from '@/lib/export/types';

const data: ExportData = {
  mediaDuration: 10,
  mediaFileName: 'test.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello world' },
    { end: 5.123, id: 'a2', speaker: 1, start: 3.0, value: 'goodbye world' },
  ],
  speakerNames: ['Alice', 'Bob'],
};

describe('srt exporter', () => {
  it('emits two blocks separated by a blank line', () => {
    const out = srt.generate(data);
    const blocks = out.split('\n\n');

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toBe('1\n00:00:00,000 --> 00:00:02,500\n[Alice] hello world');
    expect(blocks[1]).toBe('2\n00:00:03,000 --> 00:00:05,123\n[Bob] goodbye world');
  });

  it('falls back to "..." for empty segment values', () => {
    const empty: ExportData = {
      ...data,
      segments: [{ end: 1, id: 'x', speaker: 0, start: 0, value: '' }],
    };
    expect(srt.generate(empty)).toContain('[Alice] ...');
  });

  it('uses fallback speaker name when not defined', () => {
    const sparse: ExportData = {
      ...data,
      segments: [{ end: 2, id: 'a1', speaker: 5, start: 0, value: 'test' }],
      speakerNames: ['Alice'],
    };
    expect(srt.generate(sparse)).toContain('[Speaker 6]');
  });
});
