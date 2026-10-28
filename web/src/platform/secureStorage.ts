/**
 * Browser session storage.
 * Tokens live in localStorage. Native encrypted storage was removed with the Capacitor app.
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

let inMemoryToken: string | null = null;
let isInitialized = false;

const readToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const secureStorage = {
  whenReady(): Promise<void> {
    if (isInitialized) return Promise.resolve();
    inMemoryToken = readToken();
    isInitialized = true;
    return Promise.resolve();
  },

  getToken(): string | null {
    if (inMemoryToken) return inMemoryToken;
    return readToken();
  },

  async setToken(token: string): Promise<void> {
    inMemoryToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  async removeToken(): Promise<void> {
    inMemoryToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  async getUser<T>(): Promise<T | null> {
    await this.whenReady();
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  async setUser<T>(user: T): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  async removeUser(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_KEY);
    }
  },

  async clearAuth(): Promise<void> {
    await this.removeToken();
    await this.removeUser();
  },
};
