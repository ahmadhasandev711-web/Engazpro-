const SAVED_STORE_CODE_KEY = 'easyfy_saved_store_code';

export const normalizeStoreCodeInput = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9-]/g, '');

export const getSavedStoreCode = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(SAVED_STORE_CODE_KEY) || '';
  } catch {
    return '';
  }
};

export const saveStoreCode = (code?: string | null): void => {
  if (typeof window === 'undefined' || !code) return;
  const clean = code.trim().toLowerCase();
  if (!clean) return;
  try {
    localStorage.setItem(SAVED_STORE_CODE_KEY, clean);
  } catch {
    // Ignore storage quota errors
  }
};
