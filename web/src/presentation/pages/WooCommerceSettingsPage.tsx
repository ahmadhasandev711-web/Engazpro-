import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Users,
  Key,
  Warehouse,
  Copy,
  ShieldCheck,
  Zap,
  Headphones,
  X,
  AlertTriangle,
  Tag,
  DollarSign,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../../data/api/client';
import { EcommercePlatform } from '@pos-mandob/shared';
import { useAuthStore } from '../../data/store/useAuthStore';
import { useHaptic } from '../hooks/useHaptic';
import { useConfirm } from '../context/ConfirmContext';
import { Badge, Button, Card, Input, PageHeader, Select } from '../components/ui';

const SHOW_ANOOFY_UI = import.meta.env.VITE_ENABLE_ANOOFY_UI === 'true';

export const WooCommerceSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success } = useHaptic();
  const { confirm } = useConfirm();

  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [onlineBranchId, setOnlineBranchId] = useState<number | ''>('');
  const [autoSyncStock, setAutoSyncStock] = useState(true);
  const [autoSyncPrices, setAutoSyncPrices] = useState(false);
  const [autoSyncPromotions, setAutoSyncPromotions] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isConnectingOneClick, setIsConnectingOneClick] = useState(false);
  const [importStockWithProducts, setImportStockWithProducts] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [anoofyModalKey, setAnoofyModalKey] = useState<string | null>(null);
  const [copiedAnoofyKey, setCopiedAnoofyKey] = useState(false);

  // Check URL params for OAuth redirect success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setFeedback({
        type: 'success',
        message: 'تم ربط متجر ووكومرس بنجاح وتفعيل المزامنة التلقائية!',
      });
      queryClient.invalidateQueries({ queryKey: ['woocommerce-settings'] });
      useAuthStore.getState().fetchMe();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [queryClient]);

  const handleOneClickConnect = async () => {
    if (!storeUrl.trim()) {
      setFeedback({ type: 'error', message: 'يرجى كتابة رابط المتجر أولاً للربط بضغطة واحدة' });
      return;
    }
    setIsConnectingOneClick(true);
    try {
      const returnUrl = `${window.location.origin}/woocommerce/settings?auth=success`;
      const res = await apiClient.get('/woocommerce/authorize-url', {
        params: {
          store_url: storeUrl.trim(),
          return_url: returnUrl,
        },
      });
      if (res.data?.success && res.data?.data?.authorize_url) {
        window.location.href = res.data.data.authorize_url;
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'فشل إنشاء رابط الربط السريع',
      });
      setIsConnectingOneClick(false);
    }
  };

  // Fetch branches
  const { data: branchesData } = useQuery<any>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
  });
  const branches = Array.isArray(branchesData) ? branchesData : (branchesData?.data || []);

  // Fetch WooCommerce Settings
  const { data: settingsData, isLoading } = useQuery<any>({
    queryKey: ['woocommerce-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/woocommerce/settings');
      return res.data?.data;
    },
  });

  useEffect(() => {
    if (settingsData) {
      setStoreUrl(settingsData.store_url || '');
      setOnlineBranchId(settingsData.online_branch_id || '');
      setAutoSyncStock(settingsData.auto_sync_stock ?? true);
      setAutoSyncPrices(settingsData.auto_sync_prices ?? false);
      setAutoSyncPromotions(settingsData.auto_sync_promotions ?? false);
      setIsActive(settingsData.is_active ?? true);
    }
  }, [settingsData]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        store_url: storeUrl,
        online_branch_id: onlineBranchId || null,
        auto_sync_stock: autoSyncStock,
        auto_sync_prices: autoSyncPrices,
        auto_sync_promotions: autoSyncPromotions,
        is_active: isActive,
      };
      if (consumerKey) payload.consumer_key = consumerKey;
      if (consumerSecret) payload.consumer_secret = consumerSecret;

      return apiClient.post('/woocommerce/settings', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['woocommerce-settings'] });
      useAuthStore.getState().fetchMe();
      setConsumerKey('');
      setConsumerSecret('');
      setFeedback({ type: 'success', message: res.data?.message || 'تم حفظ الإعدادات بنجاح' });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'تعذر حفظ الإعدادات' });
    },
  });

  // Test Connection Mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/woocommerce/test-connection');
    },
    onSuccess: (res) => {
      setFeedback({
        type: res.data.success ? 'success' : 'error',
        message: res.data.message,
      });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'فشل الاتصال بالمتجر',
      });
    },
  });

  // Import Products Mutation
  const importProductsMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/woocommerce/import-products', {
        import_stock: importStockWithProducts,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setFeedback({ type: 'success', message: res.data?.message });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل استيراد الأصناف' });
    },
  });

  // Sync Customers Mutation
  const syncCustomersMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/woocommerce/sync-customers');
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setFeedback({ type: 'success', message: res.data?.message });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشلت مزامنة العملاء' });
    },
  });

  // Push All Stocks Mutation (Direct API Bulk Sync)
  const pushAllStocksMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/woocommerce/push-all-stocks');
    },
    onSuccess: (res) => {
      setFeedback({ type: 'success', message: res.data?.message || 'تم تحديث أرصدة كافة المنتجات في متجرك بنجاح' });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشلت مزامنة أرصدة المنتجات مع ووكومرس' });
    },
  });

  const pushAllPricesMutation = useMutation({
    mutationFn: async () => apiClient.post('/woocommerce/push-all-prices'),
    onSuccess: (res) => {
      setFeedback({ type: 'success', message: res.data?.message || 'تم تحديث أسعار المنتجات في ووكومرس بنجاح' });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشلت مزامنة الأسعار مع ووكومرس' });
    },
  });

  const syncCouponsMutation = useMutation({
    mutationFn: async () => apiClient.post('/woocommerce/sync-coupons'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setFeedback({ type: 'success', message: res.data?.message || 'تم سحب كوبونات ووكومرس بنجاح' });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل سحب كوبونات ووكومرس' });
    },
  });

  // Auto Register Webhooks Mutation
  const registerWebhooksMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/woocommerce/register-webhooks');
    },
    onSuccess: (res) => {
      setFeedback({
        type: res.data?.success ? 'success' : 'error',
        message: res.data?.message || 'تم تفعيل خطافات الويب بنجاح',
      });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'تعذر تسجيل خطافات الويب تلقائياً',
      });
    },
  });

  const copyToClipboard = (text: string, type: 'webhook' | 'secret') => {
    navigator.clipboard.writeText(text);
    success();
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const generateAnoofyKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/woocommerce/anoofy/connection-key');
      return res.data;
    },
    onSuccess: (res) => {
      if (res.data?.data?.connection_key) {
        setAnoofyModalKey(res.data.data.connection_key);
        setFeedback({ type: 'success', message: 'تم توليد مفتاح الربط بنجاح' });
      }
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'فشل توليد مفتاح الربط',
      });
    },
  });

  const disconnectAnoofyMutation = useMutation({
    mutationFn: async () => {
      return apiClient.delete('/woocommerce/anoofy/connection');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['woocommerce-settings'] });
      setFeedback({ type: 'success', message: 'تم فصل ربط إضافة Anoofy بنجاح' });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'فشل فصل ربط Anoofy',
      });
    },
  });

  const handleDisconnectAnoofy = async () => {
    const ok = await confirm({
      title: 'فصل ربط إضافة Anoofy',
      message:
        'هل أنت متأكد من رغبتك في فصل الربط مع إضافة كول سنتر Anoofy؟ لن يتم استقبال أي أحداث من الإضافة حتى يتم الربط بمفتاح جديد.',
      type: 'danger',
      confirmText: 'فصل الربط',
      cancelText: 'إلغاء',
    });
    if (ok) {
      disconnectAnoofyMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  const isConnected = Boolean(settingsData?.is_active && settingsData?.store_url);

  const branchOptions = [
    { value: '', label: '-- الفرع الرئيسي الافتراضي --' },
    ...branches.map((b: any) => ({
      value: String(b.id),
      label: `${b.name} (${b.type === 'WAREHOUSE' ? 'مستودع' : b.type === 'STORE' ? 'متجر' : 'سيارة'})`,
    })),
  ];

  const quickSyncActions = [
    {
      key: 'customers',
      title: 'استيراد عملاء المتجر إلى Easyfy',
      subtitle: 'سحب عملاء ووكومرس لبناء قاعدة بيانات تسويقية',
      icon: Users,
      isPending: syncCustomersMutation.isPending,
      onClick: () => syncCustomersMutation.mutate(),
      cardClass: 'bg-ok-soft/60 border-ok/30 hover:bg-ok-soft',
      iconClass: 'bg-ok text-on-brand',
    },
    {
      key: 'stocks',
      title: 'مزامنة أرصدة كافة المنتجات مع المتجر (Bulk Push)',
      subtitle: 'إرسال وتحديث كميات كافة الأصناف المرتبطة مباشرة في ووردبريس فوراً',
      icon: RefreshCw,
      isPending: pushAllStocksMutation.isPending,
      onClick: () => pushAllStocksMutation.mutate(),
      cardClass: 'bg-brand-soft/60 border-brand/30 hover:bg-brand-soft',
      iconClass: 'bg-brand text-on-brand',
    },
    {
      key: 'prices',
      title: 'دفع كل الأسعار لووكومرس (Bulk Price Push)',
      subtitle: 'إرسال الأسعار وسعر العرض لجميع الأصناف والمتغيرات لووكومرس فوراً',
      icon: DollarSign,
      isPending: pushAllPricesMutation.isPending,
      onClick: () => pushAllPricesMutation.mutate(),
      cardClass: 'bg-info-soft/60 border-info/30 hover:bg-info-soft',
      iconClass: 'bg-info text-on-brand',
    },
    {
      key: 'coupons',
      title: 'سحب كوبونات ووكومرس الآن',
      subtitle: 'استيراد كوبونات الخصم من ووكومرس لتعمل تلقائياً داخل الكاشير',
      icon: Tag,
      isPending: syncCouponsMutation.isPending,
      onClick: () => syncCouponsMutation.mutate(),
      cardClass: 'bg-ok-soft/60 border-ok/30 hover:bg-ok-soft',
      iconClass: 'bg-ok text-on-brand',
    },
    {
      key: 'webhooks',
      title: 'تفعيل استقبال الطلبات اللحظية (Webhooks)',
      subtitle: 'تسجيل الـ Webhook في وردبريس تلقائياً بدون تدخل يدوي',
      icon: Zap,
      isPending: registerWebhooksMutation.isPending,
      onClick: () => registerWebhooksMutation.mutate(),
      cardClass: 'bg-warn-soft/60 border-warn/30 hover:bg-warn-soft',
      iconClass: 'bg-warn text-on-brand',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="ربط متجر ووكومرس (WooCommerce)"
        description="إدارة الربط لمزامنة المنتجات وسحب الطلبات ومزامنة العملاء في الوقت الفعلي"
        badge={
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand hidden sm:inline" />
            <Badge tone={isConnected ? 'ok' : 'neutral'} dot={isConnected}>
              {isConnected ? 'متصل ونشط' : 'غير مربوط'}
            </Badge>
          </div>
        }
        actions={
          isConnected ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => testMutation.mutate()}
              isLoading={testMutation.isPending}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              فحص الاتصال بالمتجر
            </Button>
          ) : undefined
        }
        className="mb-0"
      />

      {/* Conflict Banner if Shopify is Active */}
      {useAuthStore.getState().user?.active_ecommerce_platform === EcommercePlatform.SHOPIFY && (
        <div className="p-4 rounded-2xl border bg-warn-soft border-warn/30 text-warn flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-warn" />
          <span className="text-xs font-bold">
            متجر Shopify مربوط ومفعّل حالياً. يدعم النظام منصة متجر إلكتروني واحدة فقط؛ قم بتعطيل تفعيل Shopify أولاً إذا أردت التحويل إلى WooCommerce.
          </span>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={clsx(
            'p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in duration-150',
            feedback.type === 'success'
              ? 'bg-ok-soft border-ok/30 text-ok'
              : 'bg-bad-soft border-bad/30 text-bad'
          )}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-ok" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-bad" />
          )}
          <span className="text-xs font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form & Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1-Click WooCommerce Connect Card */}
          <Card className="bg-surface-2/80 border-2 border-brand/30 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-soft border border-brand/30 flex items-center justify-center text-brand shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-ink flex items-center gap-2 flex-wrap">
                  <span>الربط السريع بضغطة زر واحدة (1-Click Connect)</span>
                  <Badge tone="warn" className="text-2xs">
                    موصى به
                  </Badge>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  لا حاجة لنسخ ولصق المفاتيح يدوياً! اكتب رابط متجرك واضغط للربط مباشرة عبر ووردبريس.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <input
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://yourstore.com"
                dir="ltr"
                className="flex-1 min-h-[44px] bg-panel border border-line rounded-xl px-3.5 py-2.5 text-ink placeholder:text-muted text-xs tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleOneClickConnect}
                isLoading={isConnectingOneClick}
                disabled={isConnectingOneClick || !storeUrl.trim()}
                leftIcon={<Zap className="w-4 h-4" />}
                className="shrink-0"
              >
                {isConnectingOneClick ? 'جاري التوجيه...' : 'ربط المتجر بضغطة واحدة'}
              </Button>
            </div>
          </Card>

          {/* API Credentials Card (Manual / Advanced) */}
          <Card className="space-y-4">
            <h2 className="text-sm font-black text-ink flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-info" />
                <span>الربط اليدوي المتقدم (API Keys)</span>
              </div>
              <Badge tone="neutral" className="text-2xs font-normal">
                خيار بديل
              </Badge>
            </h2>

            <div className="space-y-3">
              <Input
                label="رابط المتجر الإلكتروني (Store URL) *"
                name="woo_store_url"
                type="url"
                autoComplete="off"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://myfashionstore.com"
                className="text-left tabular-nums text-xs"
                dir="ltr"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Consumer Key (مفتاح العميل)"
                  name="woo_consumer_key"
                  type="password"
                  autoComplete="new-password"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder={settingsData?.consumer_key_preview || 'ck_xxxxxxxxxxxx'}
                  className="text-left tabular-nums text-xs"
                  dir="ltr"
                />

                <Input
                  label="Consumer Secret (المفتاح السري)"
                  name="woo_consumer_secret"
                  type="password"
                  autoComplete="new-password"
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="cs_xxxxxxxxxxxx"
                  className="text-left tabular-nums text-xs"
                  dir="ltr"
                />
              </div>

              <p className="text-xs text-muted">
                يمكنك توليد المفاتيح من لوحة تحكم ووردبريس:{' '}
                <span className="font-bold text-ink tabular-nums" dir="ltr">
                  WooCommerce &gt; Settings &gt; Advanced &gt; REST API
                </span>{' '}
                مع إعطاء صلاحيات <span className="font-bold text-ink">Read/Write</span>.
              </p>
            </div>
          </Card>

          {/* Sync Rules Card */}
          <Card className="space-y-4">
            <h2 className="text-sm font-black text-ink flex items-center gap-2 border-b border-line pb-3">
              <Warehouse className="w-4 h-4 text-ok" />
              <span>إعدادات الفروع وتوجيه المخزون</span>
            </h2>

            <div className="space-y-4">
              <Select
                label="الفرع أو المخزن الافتراضي للأونلاين:"
                value={String(onlineBranchId)}
                onChange={(e) => setOnlineBranchId(e.target.value ? Number(e.target.value) : '')}
                options={branchOptions}
                helperText="تُسند الطلبات الواردة إلى هذا المخزن لتجهيزها، ويمكن إعادة توجيه أي طلب لأي فرع لاحقاً."
              />

              <div className="p-4 bg-surface-2/60 border border-line rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-ink block">
                    مزامنة المخزون تلقائياً لووكومرس (Auto Stock Push)
                  </span>
                  <span className="text-xs text-muted block mt-0.5">
                    عند حدوث أي عملية بيع في المحل أو الكاشير، يتم تحديث رصيد الصنف والمتغير على ووكومرس فورياً.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSyncStock}
                  onChange={(e) => setAutoSyncStock(e.target.checked)}
                  className="w-5 h-5 text-brand rounded-lg focus:ring-brand accent-brand cursor-pointer shrink-0"
                />
              </div>

              <div className="p-4 bg-surface-2/60 border border-line rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-ink block">
                    مزامنة الأسعار وسعر العرض تلقائياً (POS → WooCommerce)
                  </span>
                  <span className="text-xs text-muted block mt-0.5">
                    عند تعديل السعر أو سعر الأوكازيون في السيستم، يتم تحديث سعر الصنف ومتغيراته في ووكومرس تلقائياً.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSyncPrices}
                  onChange={(e) => setAutoSyncPrices(e.target.checked)}
                  className="w-5 h-5 text-brand rounded-lg focus:ring-brand accent-brand cursor-pointer shrink-0"
                />
              </div>

              <div className="p-4 bg-surface-2/60 border border-line rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-ink block">
                    مزامنة الكوبونات والعروض تلقائياً (ثنائية الاتجاه)
                  </span>
                  <span className="text-xs text-muted block mt-0.5">
                    دفع كوبونات الخصم من الكاشير لووكومرس واستقبال تعديلات كوبونات المتجر عبر Webhooks.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSyncPromotions}
                  onChange={(e) => setAutoSyncPromotions(e.target.checked)}
                  className="w-5 h-5 text-brand rounded-lg focus:ring-brand accent-brand cursor-pointer shrink-0"
                />
              </div>

              <div className="p-4 bg-surface-2/60 border border-line rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-ink block">
                    تفعيل ربط WooCommerce واستقبال الطلبات
                  </span>
                  <span className="text-xs text-muted block mt-0.5">
                    إلغاء التفعيل يوقف استقبال طلبات ووكومرس ومزامنة مخزونه (يتيح لك تفعيل Shopify بدلاً منه).
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 text-brand rounded-lg focus:ring-brand accent-brand cursor-pointer shrink-0"
                />
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => saveMutation.mutate()}
                isLoading={saveMutation.isPending}
                disabled={saveMutation.isPending || !storeUrl}
                className="w-full"
              >
                {saveMutation.isPending ? 'جاري الحفظ...' : isActive ? 'حفظ وتفعيل إعدادات الربط' : 'حفظ وإيقاف الربط'}
              </Button>
            </div>
          </Card>

          {/* Anoofy-Woo Call Center Card */}
          {SHOW_ANOOFY_UI && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-ok-soft border border-ok/30 flex items-center justify-center text-ok shrink-0">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-ink">ربط إضافة كول سنتر Anoofy (Anoofy-Woo)</h2>
                    <p className="text-2xs text-muted">استقبال تأكيدات الكول سنتر وتعديل الأصناف والعناوين مباشرة</p>
                  </div>
                </div>
                <Badge tone={settingsData?.anoofy_connected ? 'ok' : 'neutral'} dot={settingsData?.anoofy_connected}>
                  {settingsData?.anoofy_connected ? 'متصل' : 'غير متصل'}
                </Badge>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                عند توليد مفتاح الربط، قم بنسخه ولصقه في إعدادات إضافة Anoofy في ووردبريس للتحقق من الاتصال واستقبال أحداث تأكيد الطلبات تلقائياً.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => generateAnoofyKeyMutation.mutate()}
                  isLoading={generateAnoofyKeyMutation.isPending}
                  disabled={generateAnoofyKeyMutation.isPending}
                  leftIcon={<Key className="w-4 h-4" />}
                >
                  {settingsData?.anoofy_connected ? 'توليد مفتاح ربط جديد (إعادة ربط)' : 'توليد مفتاح ربط جديد'}
                </Button>

                {settingsData?.anoofy_connected && (
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    onClick={handleDisconnectAnoofy}
                    isLoading={disconnectAnoofyMutation.isPending}
                    disabled={disconnectAnoofyMutation.isPending}
                  >
                    {disconnectAnoofyMutation.isPending ? 'جاري الفصل...' : 'فصل الربط'}
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right 1 Col: Quick Actions & Webhook Setup */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <Card className="space-y-4">
            <h2 className="text-sm font-black text-ink flex items-center gap-2 border-b border-line pb-3">
              <Zap className="w-4 h-4 text-warn" />
              <span>إجراءات المزامنة الفورية</span>
            </h2>

            <div className="space-y-2.5">
              {/* Primary Import Products Box */}
              <div className="p-3 bg-info-soft/60 border border-info/25 rounded-2xl space-y-2.5">
                <button
                  type="button"
                  onClick={() => importProductsMutation.mutate()}
                  disabled={importProductsMutation.isPending || !isConnected}
                  className="w-full min-h-[44px] p-2.5 bg-brand hover:bg-brand/90 text-on-brand rounded-xl text-right transition-all disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-panel/20 text-on-brand flex items-center justify-center shrink-0">
                      <Download className={`w-4 h-4 ${importProductsMutation.isPending ? 'animate-bounce' : ''}`} />
                    </div>
                    <div>
                      <span className="text-xs font-black block">استيراد الأصناف من ووكومرس</span>
                      <span className="text-2xs opacity-90 block">سحب المنتجات والمقاسات والألوان لـ Easyfy</span>
                    </div>
                  </div>
                </button>

                <label className="flex items-center gap-2 cursor-pointer pt-0.5 px-1">
                  <input
                    type="checkbox"
                    checked={importStockWithProducts}
                    onChange={(e) => setImportStockWithProducts(e.target.checked)}
                    className="w-4 h-4 rounded text-brand focus:ring-brand border-line-2 accent-brand cursor-pointer"
                  />
                  <span className="text-xs font-bold text-ink select-none">
                    استيراد كميات المخزون كرصيد أول مدة (INITIAL)
                  </span>
                </label>
              </div>

              {quickSyncActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.isPending || !isConnected}
                    className={clsx(
                      'w-full min-h-[44px] p-3.5 border rounded-2xl text-right transition-all disabled:opacity-50 cursor-pointer',
                      action.cardClass
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                          action.iconClass
                        )}
                      >
                        <Icon className={`w-4 h-4 ${action.isPending ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <span className="text-xs font-black text-ink block">{action.title}</span>
                        <span className="text-2xs text-muted block">{action.subtitle}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Webhooks Setup Guide Card */}
          {settingsData?.webhook_url && (
            <Card className="bg-surface-2/80 border-2 border-ok/25 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-ok" />
                <h3 className="text-xs font-black text-ink">الاستقبال اللحظي للطلبيات (Webhooks)</h3>
              </div>

              <div className="bg-ok-soft border border-ok/30 rounded-xl p-3 flex items-start gap-2.5 text-ok text-xs leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                <span>
                  <strong>مفعل تلقائياً:</strong> يتم تسجيل وتفعيل خطاف الويب في متجرك بوردبريس أوتوماتيكياً بمجرد ربط المتجر. لا يحتاج العميل لنسخ أو لصق أي بيانات يدوياً.
                </span>
              </div>

              <p className="text-2xs text-muted leading-relaxed pt-1">
                البيانات أدناه للمطورين أو للربط اليدوي البديل فقط (اختياري):
              </p>

              <div className="space-y-2 pt-1 text-xs">
                <div>
                  <span className="text-2xs text-muted block mb-0.5">Webhook URL:</span>
                  <div className="flex items-center gap-1 bg-panel p-2 rounded-xl border border-line">
                    <span className="tabular-nums text-2xs text-ink truncate flex-1" dir="ltr">
                      {settingsData.webhook_url}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settingsData.webhook_url, 'webhook')}
                      aria-label="نسخ رابط Webhook"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-surface-2 rounded-lg text-muted hover:text-ink cursor-pointer"
                    >
                      {copiedWebhook ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-2xs text-muted block mb-0.5">Secret:</span>
                  <div className="flex items-center gap-1 bg-panel p-2 rounded-xl border border-line">
                    <span className="tabular-nums text-2xs text-ink truncate flex-1" dir="ltr">
                      {settingsData.webhook_secret}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settingsData.webhook_secret, 'secret')}
                      aria-label="نسخ المفتاح السري"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-surface-2 rounded-lg text-muted hover:text-ink cursor-pointer"
                    >
                      {copiedSecret ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-2xs text-warn font-bold block">
                    الحدث في ووكومرس (Topic): <span className="tabular-nums">Order created</span> و{' '}
                    <span className="tabular-nums">Order updated</span>
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal: Anoofy Connection Key Dialog */}
      {SHOW_ANOOFY_UI && anoofyModalKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-panel rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-line space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-ok-soft border border-ok/30 flex items-center justify-center text-ok">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-ink">مفتاح ربط إضافة Anoofy</h3>
                  <p className="text-2xs text-muted">انسخ المفتاح وضعه في إعدادات الإضافة في ووردبريس</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAnoofyModalKey(null)}
                aria-label="إغلاق"
                className="p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="bg-warn-soft border border-warn/30 rounded-2xl p-3.5 flex items-start gap-2.5 text-warn text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <span>
                <strong>تنبيه أمني هام:</strong> احفظ هذا المفتاح الآن في إعدادات إضافة Anoofy في ووردبريس. لن تتمكن من رؤيته مرة أخرى لأسباب أمنية بعد إغلاق هذه النافذة.
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-2xs font-bold text-muted">مفتاح الربط (Connection Key):</span>
              <div className="bg-surface-2 text-ink p-3 rounded-2xl border border-line flex items-center gap-2">
                <span className="tabular-nums text-xs break-all flex-1 select-all font-bold" dir="ltr">
                  {anoofyModalKey}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (anoofyModalKey) {
                      navigator.clipboard.writeText(anoofyModalKey);
                      setCopiedAnoofyKey(true);
                      success();
                      setTimeout(() => setCopiedAnoofyKey(false), 3000);
                    }
                  }}
                  title="نسخ المفتاح"
                  aria-label="نسخ المفتاح"
                  className="shrink-0"
                >
                  {copiedAnoofyKey ? <CheckCircle2 className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-line">
              <Button type="button" variant="primary" size="md" onClick={() => setAnoofyModalKey(null)}>
                تم النسخ والحفظ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
