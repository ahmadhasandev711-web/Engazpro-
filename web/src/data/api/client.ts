import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from '../../platform/secureStorage';

// Production API URL for native mobile apps (Android & iOS)
const NATIVE_API_BASE_URL = 'https://backendapi.engazpro.com/api';

const getBaseURL = (): string => {
  // 1. Explicitly configured Vite environment variable takes highest priority
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 2. When running as a Native Mobile App (Capacitor), always connect directly to cloud backend
  if (Capacitor.isNativePlatform()) {
    return NATIVE_API_BASE_URL;
  }
  // 3. Web browser environment defaults to relative /api proxy
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

// Interceptor لإرفاق Token المصادقة من التخزين المشفر
apiClient.interceptors.request.use((config) => {
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
