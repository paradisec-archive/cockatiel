import { describe, expect, it } from 'vitest';
import { eaf } from '@/lib/export/formats/eaf';
import type { ExportData } from '@/lib/export/types';

const standardData: ExportData = {
  mediaDuration: 10,
  mediaFileName: 'test.wav',
  segments: [
    { end: 2.5, id: 'a1', speaker: 0, start: 0.0, value: 'hello world' },
    { end: 5.0, id: 'a2', speaker: 1, start: 3.0, value: 'goodbye' },
  ],
  speakerNames: ['Alice', 'Bob'],
};

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

describe('eaf exporter', () => {
  it('emits a valid ISO timestamp for the DATE attribute', () => {
    const xml = eaf.generate(standardData);
    const doc = parse(xml);
    expect(doc.documentElement.getAttribute('DATE')).toMatch(ISO_8601_REGEX);
  });

  it('includes a Transcription tier and a Speaker tier with one annotation per segment', () => {
    const xml = eaf.generate(standardData);
    const doc = parse(xml);
    const tiers = Array.from(doc.getElementsByTagName('TIER'));
    expect(tiers).toHaveLength(2);
    expect(tiers[0].getAttribute('TIER_ID')).toBe('Transcription');
    expect(tiers[1].getAttribute('TIER_ID')).toBe('Speaker');

    const transcriptionAnnotations = tiers[0].getElementsByTagName('ALIGNABLE_ANNOTATION');
    const speakerAnnotations = tiers[1].getElementsByTagName('ALIGNABLE_ANNOTATION');
    expect(transcriptionAnnotations).toHaveLength(2);
    expect(speakerAnnotations).toHaveLength(2);
  });

  it('emits TIME_SLOT entries in ascending order', () => {
    const xml = eaf.generate(standardData);
    const doc = parse(xml);
    const slots = Array.from(doc.getElementsByTagName('TIME_SLOT')).map((s) => Number(s.getAttribute('TIME_VALUE')));
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
    expect(slots).toEqual([0, 2500, 3000, 5000]);
  });

  it('guesses the media MIME type from the filename extension', () => {
    const xml = eaf.generate(standardData);
    const doc = parse(xml);
    const desc = doc.getElementsByTagName('MEDIA_DESCRIPTOR')[0];
    expect(desc.getAttribute('MIME_TYPE')).toBe('audio/wav');
  });

  it('omits the Speaker tier when there are no segments', () => {
    const empty: ExportData = { ...standardData, segments: [] };
    const xml = eaf.generate(empty);
    const doc = parse(xml);
    const tiers = Array.from(doc.getElementsByTagName('TIER'));
    expect(tiers).toHaveLength(1);
    expect(tiers[0].getAttribute('TIER_ID')).toBe('Transcription');
  });
});
