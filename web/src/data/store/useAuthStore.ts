import { create } from 'zustand';
import { apiClient } from '../api/client';
import { User, LoginInput, RegisterInput } from '@pos-mandob/shared';

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
}

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  token: localStorage.getItem('auth_token'),
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: false,
  error: null,

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', input);
      const { user, token } = response.data.data;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  register: async (input: RegisterInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/register', input);
      const { user, token } = response.data.data;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.message || 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى';
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
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      set({ user: null, token: null, isAuthenticated: false, error: null });
    }
  },

  fetchMe: async () => {
    if (!get().token) return;
    try {
      const response = await apiClient.get('/auth/me');
      const user = response.data.data;
      localStorage.setItem('auth_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch (err: any) {
      // Only clear token if server explicitly returned 401 Unauthorized.
      // Never log out on network blips, request cancellations, or mobile pull-to-refresh!
      if (err.response?.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
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
