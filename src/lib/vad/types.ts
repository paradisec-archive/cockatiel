export interface VadSegment {
  end: number;
  start: number;
}

export interface VadConfig {
  maxSpeechDuration: number;
  minSilenceDuration: number;
  minSpeechDuration: number;
  threshold: number;
}

export interface VadOptions {
  onProgress?: (fraction: number) => void;
  onStatus?: (msg: string) => void;
  signal?: AbortSignal;
}
