/**
 * Manages loading sherpa-onnx WASM modules.
 *
 * The Emscripten-generated loader expects a global `Module` object.
 * This wraps the existing global pattern — ESM refactoring is not possible
 * without rebuilding the sherpa-onnx Emscripten output.
 */

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

/**
 * Parse Emscripten download progress from a setStatus string.
 */
const parseDownloadProgress = (status: string | undefined): { fraction: number; mb: string; totalMb: string } | null => {
  const match = status?.match(/Downloading data\.\.\. \((\d+)\/(\d+)\)/);
  if (!match) return null;
  const downloaded = Number(match[1]);
  const total = Number(match[2]);
  return {
    fraction: total > 0 ? downloaded / total : 0,
    mb: (downloaded / (1024 * 1024)).toFixed(1),
    totalMb: (total / (1024 * 1024)).toFixed(1),
  };
};

/**
 * Dynamically load a script tag.
 */
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

/**
 * Load the VAD WASM module.
 * Returns the initialised Emscripten Module, cached after first load.
 */
// biome-ignore lint/suspicious/noExplicitAny: Emscripten Module is opaque
export const loadVadModule = (onStatus?: (statusText: string) => void): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (window._sherpaVadModule) {
      resolve(window._sherpaVadModule);
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Emscripten Module pattern
    const Module: any = {};

    Module.locateFile = (path: string) => `/wasm/vad/${path}`;

    Module.setStatus = (status: string) => {
      if (!status) {
        onStatus?.('VAD module ready');
        return;
      }
      const progress = parseDownloadProgress(status);
      if (progress) {
        const pct = (progress.fraction * 100).toFixed(0);
        onStatus?.(`Downloading VAD model: ${pct}% (${progress.mb}/${progress.totalMb} MB)`);
      } else {
        onStatus?.(status);
      }
    };

    Module.onRuntimeInitialized = () => {
      window._sherpaVadModule = Module;
      resolve(Module);
    };

    Module.onAbort = (what: string) => {
      reject(new Error(`WASM aborted: ${what}`));
    };

    window.Module = Module;

    (async () => {
      await loadScript('/wasm/vad/sherpa-onnx-vad.js');
      await loadScript('/wasm/vad/sherpa-onnx-wasm-main-vad.js');
    })().catch(reject);
  });
};
