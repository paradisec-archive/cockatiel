import { SAMPLE_RATE_16K } from './constants';

/**
 * Resample an AudioBuffer to 16kHz mono using OfflineAudioContext.
 */
export async function resampleTo16kMono(buffer: AudioBuffer): Promise<Float32Array> {
  const numSamples = Math.ceil(buffer.duration * SAMPLE_RATE_16K);
  const offlineCtx = new OfflineAudioContext(1, numSamples, SAMPLE_RATE_16K);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}
