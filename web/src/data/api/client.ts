import axios from 'axios';
import { secureStorage } from '../../platform/secureStorage';

const getBaseURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '/api';
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 20000,
});

// Interceptor لإرفاق Token بعد اكتمال تهيئة التخزين الآمن (يتجنب مسح الجلسة عند الإقلاع البارد)
apiClient.interceptors.request.use(async (config) => {
  await secureStorage.whenReady();
  const token = secureStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor لمعالجة الأخطاء الشائعة (مثل انتهاء الاشتراك أو انتهاء الجلسة)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await secureStorage.clearAuth();
      const publicPaths = ['/login', '/register', '/landing', '/'];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
