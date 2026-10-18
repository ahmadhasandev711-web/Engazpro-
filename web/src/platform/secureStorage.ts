import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

/**
 * Platform Layer - Secure Storage Service
 * GR-7 (DIP): native encrypted storage on mobile; web uses localStorage.
 * GR-4: session tokens must not be readable from plain SharedPreferences / backups.
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const MIGRATION_FLAG_KEY = 'auth_storage_migrated_v1';

let inMemoryToken: string | null = null;
let initPromise: Promise<void> | null = null;
let isInitialized = false;

const readLegacyPreferences = async (): Promise<{ token: string | null; user: string | null }> => {
  try {
    const [tokenRow, userRow] = await Promise.all([
      Preferences.get({ key: TOKEN_KEY }),
      Preferences.get({ key: USER_KEY }),
    ]);
    return { token: tokenRow.value, user: userRow.value };
  } catch {
    return { token: null, user: null };
  }
};

const persistNative = async (key: string, value: string | null): Promise<void> => {
  if (value === null) {
    await SecureStorage.remove(key);
    return;
  }
  await SecureStorage.setItem(key, value);
};

const readNative = async (key: string): Promise<string | null> => {
  try {
    const value = await SecureStorage.getItem(key);
    return typeof value === 'string' ? value : value != null ? String(value) : null;
  } catch {
    return null;
  }
};

const migrateFromPreferencesIfNeeded = async (): Promise<void> => {
  const migrated = await readNative(MIGRATION_FLAG_KEY);
  if (migrated === '1') return;

  const legacy = await readLegacyPreferences();
  if (legacy.token) {
    await persistNative(TOKEN_KEY, legacy.token);
    inMemoryToken = legacy.token;
  }
  if (legacy.user) {
    await persistNative(USER_KEY, legacy.user);
  }

  await Preferences.remove({ key: TOKEN_KEY });
  await Preferences.remove({ key: USER_KEY });
  await persistNative(MIGRATION_FLAG_KEY, '1');
};

const runInit = async (): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await migrateFromPreferencesIfNeeded();
      inMemoryToken = await readNative(TOKEN_KEY);
    } else if (typeof window !== 'undefined') {
      inMemoryToken = localStorage.getItem(TOKEN_KEY);
    }
  } catch {
    inMemoryToken = null;
  } finally {
    isInitialized = true;
  }
};

export const secureStorage = {
  whenReady(): Promise<void> {
    if (isInitialized) return Promise.resolve();
    if (!initPromise) {
      initPromise = runInit();
    }
    return initPromise;
  },

  getToken(): string | null {
    if (inMemoryToken) return inMemoryToken;
    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return inMemoryToken;
  },

  async setToken(token: string): Promise<void> {
    inMemoryToken = token;
    try {
      if (Capacitor.isNativePlatform()) {
        await persistNative(TOKEN_KEY, token);
      } else if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
      }
    } catch (e) {
      console.warn('Failed to persist token:', e);
    }
  },

  async removeToken(): Promise<void> {
    inMemoryToken = null;
    try {
      if (Capacitor.isNativePlatform()) {
        await persistNative(TOKEN_KEY, null);
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Failed to remove token:', e);
    }
  },

  async getUser<T>(): Promise<T | null> {
    await this.whenReady();
    try {
      let raw: string | null = null;
      if (Capacitor.isNativePlatform()) {
        raw = await readNative(USER_KEY);
      } else if (typeof window !== 'undefined') {
        raw = localStorage.getItem(USER_KEY);
      }
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setUser<T>(user: T): Promise<void> {
    try {
      const raw = JSON.stringify(user);
      if (Capacitor.isNativePlatform()) {
        await persistNative(USER_KEY, raw);
      } else if (typeof window !== 'undefined') {
        localStorage.setItem(USER_KEY, raw);
      }
    } catch (e) {
      console.warn('Failed to persist user:', e);
    }
  },

  async removeUser(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await persistNative(USER_KEY, null);
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.warn('Failed to remove user:', e);
    }
  },

  async clearAuth(): Promise<void> {
    await this.removeToken();
    await this.removeUser();
  },
};
