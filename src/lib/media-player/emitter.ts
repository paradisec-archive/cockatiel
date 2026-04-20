interface Emitter<E> {
  clear(): void;
  emit(event: E): void;
  on(listener: (event: E) => void): () => void;
}

export const createEmitter = <E>(): Emitter<E> => {
  const listeners = new Set<(event: E) => void>();
  return {
    clear: () => listeners.clear(),
    emit: (event) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    on: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
