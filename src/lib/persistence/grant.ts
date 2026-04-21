let requested = false;

const getStorageManager = (): StorageManager | undefined => (typeof navigator !== 'undefined' ? navigator.storage : undefined);

export const ensurePersistentStorage = async (): Promise<boolean> => {
  if (requested) {
    return false;
  }
  requested = true;
  const storage = getStorageManager();
  if (!storage?.persist || !storage.persisted) {
    return false;
  }
  try {
    if (await storage.persisted()) {
      return true;
    }
    return await storage.persist();
  } catch (err) {
    console.warn('Persistent storage request failed:', err);
    return false;
  }
};

export const isPersisted = async (): Promise<boolean> => {
  const storage = getStorageManager();
  if (!storage?.persisted) {
    return false;
  }
  try {
    return await storage.persisted();
  } catch {
    return false;
  }
};

export interface StorageUsage {
  quota: number;
  usage: number;
}

export const getStorageEstimate = async (): Promise<StorageUsage | null> => {
  const storage = getStorageManager();
  if (!storage?.estimate) {
    return null;
  }
  try {
    const { usage, quota } = await storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number') {
      return null;
    }
    return { quota, usage };
  } catch {
    return null;
  }
};
