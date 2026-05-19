const STORAGE_KEY = 'cockatiel:skipDownloadConfirm';

const safeStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const getSkipDownloadConfirm = (): boolean => {
  const storage = safeStorage();
  return storage?.getItem(STORAGE_KEY) === '1';
};

export const setSkipDownloadConfirm = (value: boolean): void => {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  if (value) {
    storage.setItem(STORAGE_KEY, '1');
  } else {
    storage.removeItem(STORAGE_KEY);
  }
};
