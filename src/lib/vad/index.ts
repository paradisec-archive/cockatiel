import { applyPostProcessing } from './post';
import { loadModule, runSilero } from './silero';
import type { VadConfig, VadOptions, VadSegment } from './types';

export type { VadConfig, VadSegment } from './types';

export const segment = async (samples16k: Float32Array, config: VadConfig, opts?: VadOptions): Promise<VadSegment[]> => {
  const raw = await runSilero(samples16k, config, opts);
  return applyPostProcessing(raw, config);
};

export const prewarm = async (opts?: Pick<VadOptions, 'onStatus' | 'signal'>): Promise<void> => {
  if (opts?.signal?.aborted) {
    return;
  }
  try {
    await loadModule(opts?.onStatus);
  } catch {
    // Prewarm failures are silent; segment() will surface the same error on demand.
  }
};
