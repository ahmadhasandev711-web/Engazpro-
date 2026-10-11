import { create } from 'zustand';
import { apiClient } from '../api/client';
import { User, LoginInput, RegisterInput } from '@pos-mandob/shared';
import { secureStorage } from '../../platform/secureStorage';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  activateSubscriptionCode: (code: string) => Promise<{ success: boolean; message: string }>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: secureStorage.getToken(),
  isAuthenticated: !!secureStorage.getToken(),
  isLoading: false,
  error: null,

  initializeAuth: async () => {
    await secureStorage.init();
    const token = secureStorage.getToken();
    const user = await secureStorage.getUser<User>();
    if (token) {
      set({ token, user, isAuthenticated: true });
      // Refresh profile in background
      get().fetchMe().catch(() => {});
    } else {
      set({ token: null, user: null, isAuthenticated: false });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', input);
      const { user, token } = response.data.data;
      await secureStorage.setToken(token);
      await secureStorage.setUser(user);
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
      await secureStorage.setToken(token);
      await secureStorage.setUser(user);
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
      await secureStorage.clearAuth();
      set({ user: null, token: null, isAuthenticated: false, error: null });
    }
  },

  fetchMe: async () => {
    if (!get().token) return;
    try {
      const response = await apiClient.get('/auth/me');
      const user = response.data.data;
      await secureStorage.setUser(user);
      set({ user, isAuthenticated: true });
    } catch (err: any) {
      // Only clear token if server explicitly returned 401 Unauthorized.
      if (err.response?.status === 401) {
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
