import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const isFormElement = (target: EventTarget | null): boolean => {
  const tag = (target as HTMLElement)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'Unknown error');

export const pluralizeSegment = (count: number): string => `${count} ${count === 1 ? 'segment' : 'segments'}`;
