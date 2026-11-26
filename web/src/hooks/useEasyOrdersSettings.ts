import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EasyOrdersAuthMode, EasyOrdersSettings } from '@pos-mandob/shared';
import { apiClient } from '../data/api/client';
import { useAuthStore } from '../data/store/useAuthStore';

export function useEasyOrdersSettings() {
  const queryClient = useQueryClient();
  const activeEcommercePlatform = useAuthStore((s) => s.user?.active_ecommerce_platform);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [authMode, setAuthMode] = useState<EasyOrdersAuthMode>(EasyOrdersAuthMode.API_KEY);
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [defaultBranchId, setDefaultBranchId] = useState<number | ''>('');
  const [autoSyncStock, setAutoSyncStock] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [importStock, setImportStock] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 5000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      fetchMe();
      notify('success', 'تم ربط متجر EasyOrders بنجاح عبر الربط السريع!');
      queryClient.invalidateQueries({ queryKey: ['easyorders-settings'] });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [queryClient, fetchMe]);

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      const d = res.data?.data;
      return Array.isArray(d) ? d : (d?.data || []);
    },
  });

  const { data: settings, isLoading } = useQuery<EasyOrdersSettings>({
    queryKey: ['easyorders-settings'],
    queryFn: async () => (await apiClient.get('/easyorders/settings')).data?.data ?? {},
  });

  useEffect(() => {
    if (!settings) return;
    setStoreId(settings.store_id || '');
    setStoreName(settings.store_name || '');
    setAuthMode((settings.auth_mode as EasyOrdersAuthMode) || EasyOrdersAuthMode.API_KEY);
    if (settings.webhook_secret) setWebhookSecret(settings.webhook_secret);
    setDefaultBranchId(settings.default_branch_id || '');
    setAutoSyncStock(settings.auto_sync_stock ?? true);
    if (settings.id) setIsActive(settings.is_active ?? true);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/easyorders/settings', {
        store_id: storeId.trim() || null,
        store_name: storeName.trim() || null,
        auth_mode: authMode,
        api_key: apiKey.trim() || undefined,
        webhook_secret: webhookSecret.trim() || undefined,
        default_branch_id: defaultBranchId || null,
        auto_sync_stock: autoSyncStock,
        is_active: isActive,
      }),
    onSuccess: (res) => {
      fetchMe();
      setApiKey('');
      queryClient.invalidateQueries({ queryKey: ['easyorders-settings'] });
      notify('success', res.data?.message || 'تم حفظ إعدادات EasyOrders بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'تعذر حفظ الإعدادات'),
  });

  const installLinkMutation = useMutation({
    mutationFn: async () => (await apiClient.get('/easyorders/install-link')).data?.data?.install_url as string,
    onSuccess: (url) => {
      if (url) window.open(url, '_blank', 'noopener');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'تعذر إنشاء رابط التثبيت السريع'),
  });

  const testMutation = useMutation({
    mutationFn: () => apiClient.post('/easyorders/test-connection'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['easyorders-settings'] });
      notify('success', res.data?.message || 'تم الاتصال بمتجر EasyOrders بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل الاتصال بمتجر EasyOrders'),
  });

  const importProductsMutation = useMutation({
    mutationFn: () => apiClient.post('/easyorders/import-products', { import_stock: importStock }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['easyorders-settings'] });
      notify('success', res.data?.message || 'تم بدء استيراد منتجات EasyOrders');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'تعذر استيراد منتجات EasyOrders'),
  });

  const pullOrdersMutation = useMutation({
    mutationFn: () => apiClient.post('/online-orders/pull'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['online-orders'] });
      notify('success', res.data?.message || 'تم سحب أحدث الطلبات من EasyOrders بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'تعذر سحب الطلبات'),
  });

  const pushAllStocksMutation = useMutation({
    mutationFn: () => apiClient.post('/easyorders/push-all-stocks'),
    onSuccess: (res) => notify('success', res.data?.message || 'بدأت مزامنة المخزون نحو EasyOrders'),
    onError: (err: any) => notify('error', err.response?.data?.message || 'تعذر مزامنة المخزون'),
  });

  return {
    activeEcommercePlatform,
    branches,
    settings,
    isLoading,
    storeId, setStoreId,
    storeName, setStoreName,
    authMode, setAuthMode,
    apiKey, setApiKey,
    webhookSecret, setWebhookSecret,
    defaultBranchId, setDefaultBranchId,
    autoSyncStock, setAutoSyncStock,
    isActive, setIsActive,
    importStock, setImportStock,
    feedback,
    saveMutation,
    installLinkMutation,
    testMutation,
    importProductsMutation,
    pullOrdersMutation,
    pushAllStocksMutation,
  };
}
