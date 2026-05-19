import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const isFormElement = (target: EventTarget | null): boolean => {
  const tag = (target as HTMLElement)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  // Honour the `aborted` shape from typed domain errors (e.g. RemoteAudioError)
  // so callers don't have to know which abort path the caught error came from.
  return typeof error === 'object' && error !== null && (error as { kind?: unknown }).kind === 'aborted';
};

export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'Unknown error');

export const pluralizeSegment = (count: number): string => `${count} ${count === 1 ? 'segment' : 'segments'}`;

export const titleFromFileName = (fileName: string): string => fileName.replace(/\.[^.]+$/, '') || fileName;

export const formatBytes = (n: number): string => {
  if (n >= 1024 ** 3) {
    const gb = n / 1024 ** 3;
    return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
  }
  if (n >= 1024 ** 2) {
    return `${Math.round(n / 1024 ** 2)} MB`;
  }
  if (n >= 1024) {
    return `${Math.round(n / 1024)} KB`;
  }
  return `${n} B`;
};
