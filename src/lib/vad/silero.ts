import { SAMPLE_RATE_16K } from '../constants';
import type { VadConfig, VadOptions, VadSegment } from './types';

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: Emscripten Module is opaque
    _sherpaVadModule?: any;
    // biome-ignore lint/suspicious/noExplicitAny: Emscripten Module is opaque
    Module?: any;
    // biome-ignore lint/suspicious/noExplicitAny: Emscripten binding
    createVad?: any;
  }
}

interface SherpaVadSegment {
  samples: { length: number };
  start: number;
}

interface SherpaVad {
  acceptWaveform(chunk: Float32Array): void;
  flush(): void;
  free(): void;
  front(): SherpaVadSegment;
  isEmpty(): boolean;
  pop(): void;
}

const parseDownloadProgress = (status: string | undefined): { fraction: number; mb: string; totalMb: string } | null => {
  const match = status?.match(/Downloading data\.\.\. \((\d+)\/(\d+)\)/);
  if (!match) {
    return null;
  }
  const downloaded = Number(match[1]);
  const total = Number(match[2]);
  return {
    fraction: total > 0 ? downloaded / total : 0,
    mb: (downloaded / (1024 * 1024)).toFixed(1),
    totalMb: (total / (1024 * 1024)).toFixed(1),
  };
};

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
  });
};

type StatusListener = (msg: string) => void;
const statusListeners = new Set<StatusListener>();
const broadcast = (msg: string): void => {
  for (const listener of statusListeners) {
    listener(msg);
  }
};

// biome-ignore lint/suspicious/noExplicitAny: Emscripten Module is opaque
let loadPromise: Promise<any> | null = null;

// biome-ignore lint/suspicious/noExplicitAny: Emscripten Module is opaque
export const loadModule = (onStatus?: StatusListener): Promise<any> => {
  // Already loaded — no status events will fire, so skip listener registration
  // to avoid leaking the closure. window._sherpaVadModule survives HMR across
  // module reloads while loadPromise handles in-session dedupe.
  if (window._sherpaVadModule) {
    if (!loadPromise) {
      loadPromise = Promise.resolve(window._sherpaVadModule);
    }
    return loadPromise;
  }

  if (onStatus) {
    statusListeners.add(onStatus);
  }

  if (loadPromise) {
    return loadPromise;
  }

  const wasmBase = `${import.meta.env.BASE_URL}wasm/vad/`;

  loadPromise = new Promise((resolve, reject) => {
    // biome-ignore lint/suspicious/noExplicitAny: Emscripten Module pattern
    const Module: any = {};

    Module.locateFile = (path: string) => `${wasmBase}${path}`;

    Module.setStatus = (status: string) => {
      if (!status) {
        broadcast('VAD module ready');
        return;
      }
      const progress = parseDownloadProgress(status);
      if (progress) {
        const pct = (progress.fraction * 100).toFixed(0);
        broadcast(`Downloading VAD model: ${pct}% (${progress.mb}/${progress.totalMb} MB)`);
      } else {
        broadcast(status);
      }
    };

    Module.onRuntimeInitialized = () => {
      window._sherpaVadModule = Module;
      statusListeners.clear();
      resolve(Module);
    };

    Module.onAbort = (what: string) => {
      statusListeners.clear();
      reject(new Error(`Speech detector aborted: ${what}`));
    };

    window.Module = Module;

    (async () => {
      await loadScript(`${wasmBase}sherpa-onnx-vad.js`);
      await loadScript(`${wasmBase}sherpa-onnx-wasm-main-vad.js`);
    })().catch(reject);
  });

  // Clear cache on failure so a subsequent attempt can retry from scratch.
  loadPromise.catch(() => {
    loadPromise = null;
    statusListeners.clear();
  });

  return loadPromise;
};

const drainSegments = (vad: SherpaVad, segments: VadSegment[]): void => {
  while (!vad.isEmpty()) {
    const segment = vad.front();
    const startSample = segment.start;
    const numSamples = segment.samples.length;
    segments.push({
      end: (startSample + numSamples) / SAMPLE_RATE_16K,
      start: startSample / SAMPLE_RATE_16K,
    });
    vad.pop();
  }
};

const yieldToUI = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
};

export const runSilero = async (
  samples: Float32Array,
  config: VadConfig,
  opts?: Pick<VadOptions, 'onProgress' | 'onStatus' | 'signal'>,
): Promise<VadSegment[]> => {
  throwIfAborted(opts?.signal);
  const Module = await loadModule(opts?.onStatus);
  throwIfAborted(opts?.signal);

  if (!window.createVad) {
    throw new Error('Speech detector runtime missing createVad binding');
  }

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

  const vad = window.createVad(Module, vadConfig) as SherpaVad;
  const segments: VadSegment[] = [];

  try {
    const totalChunks = Math.floor(samples.length / windowSize);
    for (let i = 0; i < totalChunks; i++) {
      if (opts?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const chunk = samples.subarray(i * windowSize, (i + 1) * windowSize);
      vad.acceptWaveform(chunk);
      drainSegments(vad, segments);

      if (i % 500 === 0) {
        opts?.onProgress?.(i / totalChunks);
        await yieldToUI();
      }
    }

    vad.flush();
    drainSegments(vad, segments);
  } finally {
    vad.free();
  }

  opts?.onProgress?.(1);
  return segments;
};
