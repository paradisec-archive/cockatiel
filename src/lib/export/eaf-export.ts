import { getSpeakerName } from '../constants';
import type { ExportData } from './types';

const guessMimeType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const types: Record<string, string> = {
    aac: 'audio/aac',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/x-wav',
    wma: 'audio/x-ms-wma',
  };
  return types[ext] ?? 'audio/*';
};

export const generateEaf = (data: ExportData): string => {
  const timeMap = new Map<number, string>();
  let slotCounter = 1;

  const getSlotId = (seconds: number): string => {
    const ms = Math.round(seconds * 1000);
    if (!timeMap.has(ms)) {
      timeMap.set(ms, `ts${slotCounter++}`);
    }
    // biome-ignore lint/style/noNonNullAssertion: we just set the key above
    return timeMap.get(ms)!;
  };

  // Pre-register all time slots
  for (const ann of data.segments) {
    getSlotId(ann.start);
    getSlotId(ann.end);
  }

  const doc = document.implementation.createDocument(null, 'ANNOTATION_DOCUMENT', null);
  const root = doc.documentElement;
  root.setAttribute('AUTHOR', 'cockatiel');
  root.setAttribute('DATE', new Date().toISOString());
  root.setAttribute('FORMAT', '3.0');
  root.setAttribute('VERSION', '3.0');
  root.setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
  root.setAttribute('xsi:noNamespaceSchemaLocation', 'http://www.mpi.nl/tools/elan/EAFv3.0.xsd');

  // HEADER
  const header = doc.createElement('HEADER');
  header.setAttribute('MEDIA_FILE', '');
  header.setAttribute('TIME_UNITS', 'milliseconds');

  if (data.mediaFileName) {
    const mediaDesc = doc.createElement('MEDIA_DESCRIPTOR');
    mediaDesc.setAttribute('MEDIA_URL', `file:///./${data.mediaFileName}`);
    mediaDesc.setAttribute('RELATIVE_MEDIA_URL', `./${data.mediaFileName}`);
    mediaDesc.setAttribute('MIME_TYPE', guessMimeType(data.mediaFileName));
    header.appendChild(mediaDesc);
  }
  root.appendChild(header);

  // TIME_ORDER
  const timeOrder = doc.createElement('TIME_ORDER');
  const sortedTimes = [...timeMap.entries()].sort((a, b) => a[0] - b[0]);
  for (const [ms, slotId] of sortedTimes) {
    const slot = doc.createElement('TIME_SLOT');
    slot.setAttribute('TIME_SLOT_ID', slotId);
    slot.setAttribute('TIME_VALUE', String(ms));
    timeOrder.appendChild(slot);
  }
  root.appendChild(timeOrder);

  // Transcription TIER
  let annCounter = 1;
  const tierEl = doc.createElement('TIER');
  tierEl.setAttribute('TIER_ID', 'Transcription');
  tierEl.setAttribute('LINGUISTIC_TYPE_REF', 'default-lt');
  tierEl.setAttribute('PARTICIPANT', '');
  tierEl.setAttribute('ANNOTATOR', 'cockatiel');

  for (const ann of data.segments) {
    const annotationEl = doc.createElement('ANNOTATION');
    const alignable = doc.createElement('ALIGNABLE_ANNOTATION');
    alignable.setAttribute('ANNOTATION_ID', `a${annCounter++}`);
    alignable.setAttribute('TIME_SLOT_REF1', getSlotId(ann.start));
    alignable.setAttribute('TIME_SLOT_REF2', getSlotId(ann.end));

    const valueEl = doc.createElement('ANNOTATION_VALUE');
    valueEl.textContent = ann.value;
    alignable.appendChild(valueEl);
    annotationEl.appendChild(alignable);
    tierEl.appendChild(annotationEl);
  }
  root.appendChild(tierEl);

  // Speaker TIER (derived from transcription annotations)
  let hasSpeakers = false;
  const spkTierEl = doc.createElement('TIER');
  spkTierEl.setAttribute('TIER_ID', 'Speaker');
  spkTierEl.setAttribute('LINGUISTIC_TYPE_REF', 'default-lt');
  spkTierEl.setAttribute('PARTICIPANT', '');
  spkTierEl.setAttribute('ANNOTATOR', 'cockatiel');

  for (const ann of data.segments) {
    hasSpeakers = true;
    const spkName = getSpeakerName(data.speakerNames, ann.speaker);
    const annotationEl = doc.createElement('ANNOTATION');
    const alignable = doc.createElement('ALIGNABLE_ANNOTATION');
    alignable.setAttribute('ANNOTATION_ID', `a${annCounter++}`);
    alignable.setAttribute('TIME_SLOT_REF1', getSlotId(ann.start));
    alignable.setAttribute('TIME_SLOT_REF2', getSlotId(ann.end));

    const valueEl = doc.createElement('ANNOTATION_VALUE');
    valueEl.textContent = spkName;
    alignable.appendChild(valueEl);
    annotationEl.appendChild(alignable);
    spkTierEl.appendChild(annotationEl);
  }
  if (hasSpeakers) {
    root.appendChild(spkTierEl);
  }

  // LINGUISTIC_TYPE
  const lt = doc.createElement('LINGUISTIC_TYPE');
  lt.setAttribute('LINGUISTIC_TYPE_ID', 'default-lt');
  lt.setAttribute('TIME_ALIGNABLE', 'true');
  lt.setAttribute('GRAPHIC_REFERENCES', 'false');
  root.appendChild(lt);

  // CONSTRAINTs
  const constraints: Array<[string, string]> = [
    ['Time_Subdivision', "Time subdivision of parent annotation's time interval, no time gaps allowed within this interval"],
    ['Symbolic_Subdivision', 'Symbolic subdivision of a parent annotation. Annotations refering to the same parent are ordered'],
    ['Symbolic_Association', '1-1 association with a parent annotation'],
    ['Included_In', "Time alignable annotations within the parent annotation's time interval, gaps are allowed"],
  ];
  for (const [stereotype, description] of constraints) {
    const c = doc.createElement('CONSTRAINT');
    c.setAttribute('STEREOTYPE', stereotype);
    c.setAttribute('DESCRIPTION', description);
    root.appendChild(c);
  }

  const serialiser = new XMLSerializer();
  const xmlStr = serialiser.serializeToString(doc);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlStr}`;
};
