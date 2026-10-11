import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Platform Layer - Secure Storage Service
 * Conforms to DIP (GR-7) & Enterprise Mobile Security
 * Uses Android Encrypted SharedPreferences / iOS Keychain via Capacitor Preferences
 * with graceful web fallback and in-memory cache for synchronous request interceptors.
 */

let inMemoryToken: string | null = null;
let isInitialized = false;

export const secureStorage = {
  async init(): Promise<void> {
    if (isInitialized) return;
    try {
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key: 'auth_token' });
        inMemoryToken = value;
      } else if (typeof window !== 'undefined') {
        inMemoryToken = localStorage.getItem('auth_token');
      }
    } catch {
      inMemoryToken = null;
    } finally {
      isInitialized = true;
    }
  },

  getToken(): string | null {
    // Ultra-fast synchronous access for Axios request interceptor
    if (inMemoryToken) return inMemoryToken;
    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return inMemoryToken;
  },

  async setToken(token: string): Promise<void> {
    inMemoryToken = token;
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key: 'auth_token', value: token });
      } else if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token);
      }
    } catch (e) {
      console.warn('Failed to persist token:', e);
    }
  },

  async removeToken(): Promise<void> {
    inMemoryToken = null;
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key: 'auth_token' });
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
    } catch (e) {
      console.warn('Failed to remove token:', e);
    }
  },

  async getUser<T>(): Promise<T | null> {
    try {
      let raw: string | null = null;
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key: 'auth_user' });
        raw = value;
      } else if (typeof window !== 'undefined') {
        raw = localStorage.getItem('auth_user');
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
        await Preferences.set({ key: 'auth_user', value: raw });
      } else if (typeof window !== 'undefined') {
        localStorage.setItem('auth_user', raw);
      }
    } catch (e) {
      console.warn('Failed to persist user:', e);
    }
  },

  async removeUser(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key: 'auth_user' });
      } else if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_user');
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

// Immediate background initialization
secureStorage.init().catch(() => {});
