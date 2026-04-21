import { describe, expect, it } from 'vitest';
import { escapeCsv, escapeTextGridQuotes, formatHhmmssMmm, formatSeconds3dp, tabular } from '@/lib/export/tabular';
import type { ExportData } from '@/lib/export/types';

const data: ExportData = {
  mediaDuration: 10,
  mediaFileName: 'test.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello' },
    { end: 5.0, id: 'a2', speaker: 1, start: 3.0, value: 'world' },
  ],
  speakerNames: ['Alice', 'Bob'],
  title: 'test',
};

describe('time formatters', () => {
  describe('formatSeconds3dp', () => {
    it('formats whole seconds with three decimals', () => {
      expect(formatSeconds3dp(0)).toBe('0.000');
      expect(formatSeconds3dp(2.5)).toBe('2.500');
    });

    it('rounds at the third decimal', () => {
      expect(formatSeconds3dp(1.2345)).toBe('1.234');
      expect(formatSeconds3dp(1.2346)).toBe('1.235');
    });
  });

  describe('formatHhmmssMmm', () => {
    it('formats zero seconds', () => {
      expect(formatHhmmssMmm(0)).toBe('00:00:00,000');
    });

    it('formats sub-second values with millisecond precision', () => {
      expect(formatHhmmssMmm(2.5)).toBe('00:00:02,500');
      expect(formatHhmmssMmm(5.123)).toBe('00:00:05,123');
    });

    it('rolls minutes and hours at the right boundaries', () => {
      expect(formatHhmmssMmm(60)).toBe('00:01:00,000');
      expect(formatHhmmssMmm(3600)).toBe('01:00:00,000');
      expect(formatHhmmssMmm(3661.5)).toBe('01:01:01,500');
    });
  });
});

describe('escapers', () => {
  describe('escapeCsv', () => {
    it('passes plain values through unchanged', () => {
      expect(escapeCsv('hello world')).toBe('hello world');
    });

    it('wraps values containing commas in quotes', () => {
      expect(escapeCsv('hello, world')).toBe('"hello, world"');
    });

    it('wraps and doubles inner quotes', () => {
      expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    });

    it('wraps values containing newlines', () => {
      expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
    });

    it('handles all special characters together', () => {
      expect(escapeCsv('a,b"c\nd')).toBe('"a,b""c\nd"');
    });
  });

  describe('escapeTextGridQuotes', () => {
    it('doubles quotes', () => {
      expect(escapeTextGridQuotes('say "hi"')).toBe('say ""hi""');
    });

    it('leaves commas and newlines unchanged', () => {
      expect(escapeTextGridQuotes('hello, world\nnext')).toBe('hello, world\nnext');
    });
  });
});

describe('tabular', () => {
  it('emits rows joined by the default separator (newline)', () => {
    const out = tabular(data, {
      row: ({ index, seg, speakerName, time }) => `${index}|${time(seg.start)}|${speakerName}|${seg.value}`,
      time: formatSeconds3dp,
    });
    expect(out).toBe('1|0.000|Alice|hello\n2|3.000|Bob|world');
  });

  it('prepends header when provided', () => {
    const out = tabular(data, {
      header: 'IDX|START|SPK|TXT',
      row: ({ index, seg, speakerName, time }) => `${index}|${time(seg.start)}|${speakerName}|${seg.value}`,
      time: formatSeconds3dp,
    });
    expect(out.split('\n')[0]).toBe('IDX|START|SPK|TXT');
    expect(out.split('\n')).toHaveLength(3);
  });

  it('uses a custom separator when provided', () => {
    const out = tabular(data, {
      row: ({ index, seg, speakerName, time }) => `${index}|${time(seg.start)}|${speakerName}|${seg.value}`,
      separator: '\n\n',
      time: formatSeconds3dp,
    });
    expect(out).toBe('1|0.000|Alice|hello\n\n2|3.000|Bob|world');
  });

  it('passes 1-based index to the row callback', () => {
    const indexes: number[] = [];
    tabular(data, {
      row: ({ index }) => {
        indexes.push(index);
        return '';
      },
      time: formatSeconds3dp,
    });
    expect(indexes).toEqual([1, 2]);
  });

  it('resolves fallback speaker names when index is out of range', () => {
    const sparse: ExportData = {
      ...data,
      segments: [{ end: 1, id: 'x', speaker: 5, start: 0, value: 't' }],
      speakerNames: ['Alice'],
      title: 'test',
    };
    const out = tabular(sparse, {
      row: ({ speakerName }) => speakerName,
      time: formatSeconds3dp,
    });
    expect(out).toContain('Speaker 6');
  });

  it('uses identity escape by default', () => {
    const out = tabular(data, {
      row: ({ esc, seg }) => esc(seg.value),
      time: formatSeconds3dp,
    });
    expect(out).toBe('hello\nworld');
  });
});
