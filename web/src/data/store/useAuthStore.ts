import { create } from 'zustand';
import { apiClient } from '../api/client';
import { queryClient } from '../api/queryClient';
import { User, LoginInput, RegisterInput } from '@pos-mandob/shared';
import { secureStorage } from '../../platform/secureStorage';
import { saveStoreCode } from '../../platform/storeCodeStorage';

const IMPERSONATION_BACKUP_KEY = 'admin_impersonation_backup';

interface ImpersonationBackup {
  adminToken: string;
  adminUser: User;
  storeName: string;
}

const readImpersonationBackup = (): ImpersonationBackup | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_BACKUP_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationBackup) : null;
  } catch {
    return null;
  }
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  authHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  impersonation: ImpersonationBackup | null;
  login: (input: LoginInput) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  activateSubscriptionCode: (code: string) => Promise<{ success: boolean; message: string }>;
  startImpersonation: (storeUser: User, storeToken: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  authHydrated: false,
  isLoading: false,
  error: null,
  impersonation: readImpersonationBackup(),

  initializeAuth: async () => {
    await secureStorage.whenReady();
    const token = secureStorage.getToken();
    const user = await secureStorage.getUser<User>();
    const impersonation = readImpersonationBackup();
    if (token) {
      set({ token, user, isAuthenticated: true, authHydrated: true, impersonation });
      get().fetchMe().catch(() => {});
    } else {
      set({ token: null, user: null, isAuthenticated: false, authHydrated: true, impersonation: null });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', input);
      const { user, token } = response.data.data;
      queryClient.clear();
      await secureStorage.setToken(token);
      await secureStorage.setUser(user);
      saveStoreCode(user?.store_code || input.store_code);
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      let message = err.response?.data?.message;
      if (!message) {
        if (err.message === 'Network Error' || !err.response) {
          message = 'تعذر الاتصال بالخادم. يرجى التأكد من اتصال الإنترنت أو المحاولة لاحقاً';
        } else {
          message = 'فشل تسجيل الدخول. يرجى التحقق من البيانات';
        }
      }
      set({ error: message, isLoading: false });
      return false;
    }
  },

  register: async (input: RegisterInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/register', input);
      const { user, token } = response.data.data;
      queryClient.clear();
      await secureStorage.setToken(token);
      await secureStorage.setUser(user);
      saveStoreCode(user?.store_code || input.store_code);
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      let message = err.response?.data?.message;
      if (!message) {
        if (err.message === 'Network Error' || !err.response) {
          message = 'تعذر الاتصال بالخادم. يرجى التأكد من اتصال الإنترنت أو المحاولة لاحقاً';
        } else {
          message = 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى';
        }
      }
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      if (get().token) {
        await apiClient.post('/auth/logout');
      }
    } catch {
      // Ignore errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(IMPERSONATION_BACKUP_KEY);
      }
      queryClient.clear();
      await secureStorage.clearAuth();
      set({ user: null, token: null, isAuthenticated: false, error: null, impersonation: null });
    }
  },

  startImpersonation: async (storeUser: User, storeToken: string) => {
    const currentToken = get().token;
    const currentUser = get().user;
    if (!currentToken || !currentUser) return;

    const existingBackup = readImpersonationBackup();
    const backup: ImpersonationBackup = existingBackup ?? {
      adminToken: currentToken,
      adminUser: currentUser,
      storeName: storeUser.name,
    };
    const nextBackup: ImpersonationBackup = { ...backup, storeName: storeUser.name };

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(IMPERSONATION_BACKUP_KEY, JSON.stringify(nextBackup));
    }
    queryClient.clear();
    await secureStorage.setToken(storeToken);
    await secureStorage.setUser(storeUser);
    set({ user: storeUser, token: storeToken, isAuthenticated: true, impersonation: nextBackup, error: null });
  },

  exitImpersonation: async () => {
    const backup = readImpersonationBackup() ?? get().impersonation;
    if (!backup) return;
    try {
      if (get().token) {
        await apiClient.post('/auth/logout');
      }
    } catch {
      // Ignore logout failure on temporary impersonation token
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(IMPERSONATION_BACKUP_KEY);
    }
    queryClient.clear();
    await secureStorage.setToken(backup.adminToken);
    await secureStorage.setUser(backup.adminUser);
    set({
      user: backup.adminUser,
      token: backup.adminToken,
      isAuthenticated: true,
      impersonation: null,
      error: null,
    });
  },

  fetchMe: async () => {
    if (!get().token) return;
    try {
      const response = await apiClient.get('/auth/me');
      const user = response.data.data;
      const prevUser = get().user;
      if (
        prevUser &&
        (prevUser.id !== user.id ||
          prevUser.owner_id !== user.owner_id ||
          prevUser.branch_id !== user.branch_id ||
          prevUser.role !== user.role)
      ) {
        queryClient.clear();
      }
      await secureStorage.setUser(user);
      set({ user, isAuthenticated: true });
    } catch (err: any) {
      // Only clear token if server explicitly returned 401 Unauthorized.
      if (err.response?.status === 401) {
        queryClient.clear();
        await secureStorage.clearAuth();
        set({ user: null, token: null, isAuthenticated: false });
      }
    }
  },

  activateSubscriptionCode: async (code: string) => {
    try {
      const response = await apiClient.post('/subscription/activate-code', { code });
      if (response.data.success) {
        await get().fetchMe();
        return {
          success: true,
          message: response.data.message || 'تم تفعيل الاشتراك بنجاح!',
        };
      }
      return { success: false, message: 'فشل تفعيل الكود' };
    } catch (err: any) {
      const message =
        err.response?.data?.errors?.code?.[0] ||
        err.response?.data?.message ||
        'كود التفعيل غير صالح أو تم استخدامه مسبقاً';
      return { success: false, message };
    }
  },
}));

// Auto-run initialization on startup
useAuthStore.getState().initializeAuth().catch(() => {});
