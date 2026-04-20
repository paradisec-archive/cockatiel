import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VadConfig } from '@/lib/vad/types';

const CONFIG: VadConfig = {
  maxSpeechDuration: 30,
  minSilenceDuration: 0.3,
  minSpeechDuration: 0.25,
  threshold: 0.5,
};

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/lib/vad/silero');
});

describe('segment', () => {
  it('rejects with AbortError when the signal is already aborted', async () => {
    const { segment } = await import('@/lib/vad');
    const ctrl = new AbortController();
    ctrl.abort();

    let caught: unknown;
    try {
      await segment(new Float32Array(16_000), CONFIG, { signal: ctrl.signal });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DOMException);
    expect((caught as DOMException).name).toBe('AbortError');
  });

  it('surfaces a clear error when the speech detector fails to load', async () => {
    vi.doMock('@/lib/vad/silero', () => ({
      loadModule: vi.fn().mockRejectedValue(new Error('Failed to load: /wasm/vad/sherpa-onnx-vad.js')),
      runSilero: vi.fn().mockRejectedValue(new Error('Failed to load: /wasm/vad/sherpa-onnx-vad.js')),
    }));

    const { segment } = await import('@/lib/vad');
    await expect(segment(new Float32Array(16_000), CONFIG)).rejects.toThrow(/failed to load/i);
  });

  it('applies post-processing to raw backend output', async () => {
    vi.doMock('@/lib/vad/silero', () => ({
      loadModule: vi.fn().mockResolvedValue({}),
      runSilero: vi.fn().mockResolvedValue([
        { end: 0.1, start: 0 }, // below minSpeechDuration — dropped
        { end: 75, start: 0.5 }, // 74.5s — split into 30 + 30 + 14.5
      ]),
    }));

    const { segment } = await import('@/lib/vad');
    const result = await segment(new Float32Array(16_000), CONFIG);

    expect(result).toEqual([
      { end: 30.5, start: 0.5 },
      { end: 60.5, start: 30.5 },
      { end: 75, start: 60.5 },
    ]);
  });
});

describe('prewarm', () => {
  it('swallows loader failures', async () => {
    vi.doMock('@/lib/vad/silero', () => ({
      loadModule: vi.fn().mockRejectedValue(new Error('boom')),
      runSilero: vi.fn(),
    }));

    const { prewarm } = await import('@/lib/vad');
    await expect(prewarm()).resolves.toBeUndefined();
  });

  it('returns immediately when the signal is already aborted', async () => {
    const loadModule = vi.fn();
    vi.doMock('@/lib/vad/silero', () => ({
      loadModule,
      runSilero: vi.fn(),
    }));

    const { prewarm } = await import('@/lib/vad');
    const ctrl = new AbortController();
    ctrl.abort();
    await prewarm({ signal: ctrl.signal });
    expect(loadModule).not.toHaveBeenCalled();
  });
});
