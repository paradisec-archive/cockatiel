import { describe, expect, it } from 'vitest';
import { generateSrt } from '@/lib/export/srt-export';
import type { ExportData } from '@/lib/export/types';

const testData: ExportData = {
  mediaDuration: 10,
  mediaFileName: 'test.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello world' },
    { end: 5.123, id: 'a2', speaker: 1, start: 3.0, value: 'goodbye world' },
  ],
  speakerNames: ['Alice', 'Bob'],
};

describe('generateSrt', () => {
  it('generates valid SRT format', () => {
    const srt = generateSrt(testData);
    const blocks = srt.split('\n\n');

    expect(blocks).toHaveLength(2);

    // First subtitle
    expect(blocks[0]).toContain('1');
    expect(blocks[0]).toContain('00:00:00,000 --> 00:00:02,500');
    expect(blocks[0]).toContain('[Alice] hello world');

    // Second subtitle
    expect(blocks[1]).toContain('2');
    expect(blocks[1]).toContain('00:00:03,000 --> 00:00:05,123');
    expect(blocks[1]).toContain('[Bob] goodbye world');
  });

  it('uses fallback speaker name when not defined', () => {
    const data: ExportData = {
      ...testData,
      segments: [{ end: 2, id: 'a1', speaker: 5, start: 0, value: 'test' }],
      speakerNames: ['Alice'],
    };
    const srt = generateSrt(data);
    expect(srt).toContain('[Speaker 6]');
  });
});
