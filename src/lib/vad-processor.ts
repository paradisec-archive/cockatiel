import { SAMPLE_RATE_16K } from './constants';

export interface VadConfig {
  maxSpeechDuration: number;
  minSilenceDuration: number;
  minSpeechDuration: number;
  threshold: number;
}

export interface VadSegment {
  end: number;
  start: number;
}

interface SherpaVadSegment {
  start: number;
  samples: { length: number };
}

interface SherpaVad {
  isEmpty(): boolean;
  front(): SherpaVadSegment;
  pop(): void;
  acceptWaveform(chunk: Float32Array): void;
  flush(): void;
  free(): void;
}

/** Drain completed segments from the VAD into the segments array. */
const drainSegments = (vad: SherpaVad, segments: VadSegment[], sampleRate: number): void => {
  while (!vad.isEmpty()) {
    const segment = vad.front();
    const startSample = segment.start;
    const numSamples = segment.samples.length;
    segments.push({
      end: (startSample + numSamples) / sampleRate,
      start: startSample / sampleRate,
    });
    vad.pop();
  }
};

/** Yield to the browser so it can repaint. */
const yieldToUI = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Run Silero VAD using the sherpa-onnx WASM module.
 */
export const runSileroVad = async (
  // biome-ignore lint/suspicious/noExplicitAny: Emscripten Module type is opaque
  Module: any,
  samples: Float32Array,
  config: VadConfig,
  onProgress?: (fraction: number) => void,
): Promise<VadSegment[]> => {
  const windowSize = 512;

  const vadConfig = {
    bufferSizeInSeconds: 60,
    debug: 0,
    numThreads: 1,
    provider: 'cpu',
    sampleRate: SAMPLE_RATE_16K,
    sileroVad: {
      maxSpeechDuration: config.maxSpeechDuration,
      minSilenceDuration: config.minSilenceDuration,
      minSpeechDuration: config.minSpeechDuration,
      model: 'silero_vad.onnx',
      threshold: config.threshold,
      windowSize,
    },
  };

  // createVad is a global function injected by sherpa-onnx-vad.js (typed in wasm-manager.ts)
  const vad: SherpaVad = window.createVad(Module, vadConfig);
  const segments: VadSegment[] = [];

  const totalChunks = Math.floor(samples.length / windowSize);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = samples.subarray(i * windowSize, (i + 1) * windowSize);
    vad.acceptWaveform(chunk);
    drainSegments(vad, segments, SAMPLE_RATE_16K);

    if (i % 500 === 0) {
      onProgress?.(i / totalChunks);
      await yieldToUI();
    }
  }

  vad.flush();
  drainSegments(vad, segments, SAMPLE_RATE_16K);
  vad.free();

  onProgress?.(1);
  return segments;
};

/**
 * Simple energy-based VAD (fallback when WASM is not available).
 */
export const runEnergyVad = async (samples: Float32Array, config: VadConfig, onProgress?: (fraction: number) => void): Promise<VadSegment[]> => {
  const frameSize = 512;
  const numFrames = Math.floor(samples.length / frameSize);

  // Compute frame energies
  const energies = new Float32Array(numFrames);
  let maxEnergy = 0;
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    const offset = i * frameSize;
    for (let j = 0; j < frameSize; j++) {
      const s = samples[offset + j];
      sum += s * s;
    }
    energies[i] = Math.sqrt(sum / frameSize);
    if (energies[i] > maxEnergy) maxEnergy = energies[i];

    if (i % 1000 === 0) {
      onProgress?.((i / numFrames) * 0.5);
      await yieldToUI();
    }
  }

  // Threshold
  const energyThreshold = config.threshold * maxEnergy * 0.5;
  const isSpeech = new Uint8Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    isSpeech[i] = energies[i] > energyThreshold ? 1 : 0;
  }

  // Fill short silence gaps
  const frameDuration = frameSize / SAMPLE_RATE_16K;
  const minSilenceFrames = Math.ceil(config.minSilenceDuration / frameDuration);

  for (let i = 0; i < numFrames; i++) {
    if (isSpeech[i] === 0) {
      let silenceLen = 0;
      while (i + silenceLen < numFrames && isSpeech[i + silenceLen] === 0) {
        silenceLen++;
      }
      if (silenceLen < minSilenceFrames && i > 0 && i + silenceLen < numFrames) {
        for (let j = 0; j < silenceLen; j++) {
          isSpeech[i + j] = 1;
        }
      }
      i += silenceLen - 1;
    }
  }

  // Extract segments
  const segments: VadSegment[] = [];
  let segStart = -1;
  for (let i = 0; i < numFrames; i++) {
    if (isSpeech[i] && segStart === -1) {
      segStart = i;
    } else if (!isSpeech[i] && segStart !== -1) {
      const startTime = segStart * frameDuration;
      const endTime = i * frameDuration;
      if (endTime - startTime >= config.minSpeechDuration) {
        segments.push({ end: endTime, start: startTime });
      }
      segStart = -1;
    }
    if (i % 1000 === 0) {
      onProgress?.(0.5 + (i / numFrames) * 0.5);
      await yieldToUI();
    }
  }
  if (segStart !== -1) {
    const startTime = segStart * frameDuration;
    const endTime = numFrames * frameDuration;
    if (endTime - startTime >= config.minSpeechDuration) {
      segments.push({ end: endTime, start: startTime });
    }
  }

  // Split long segments
  const maxDur = config.maxSpeechDuration;
  const finalSegments: VadSegment[] = [];
  for (const seg of segments) {
    if (seg.end - seg.start <= maxDur) {
      finalSegments.push(seg);
    } else {
      let t = seg.start;
      while (t < seg.end) {
        const end = Math.min(t + maxDur, seg.end);
        finalSegments.push({ end, start: t });
        t = end;
      }
    }
  }

  onProgress?.(1);
  return finalSegments;
};
