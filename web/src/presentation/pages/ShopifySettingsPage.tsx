import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Warehouse,
  Copy,
  Zap,
  MapPin,
  Webhook,
  Tag,
  DollarSign,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { EcommercePlatform, ShopifyAuthMode } from '@pos-mandob/shared';
import { useAuthStore } from '../../data/store/useAuthStore';
import { Badge, Button, Card, Input, PageHeader, Select } from '../components/ui';

interface LocationMappingRow {
  id: number;
  shopify_location_id: number;
  shopify_location_name: string;
  branch_id: number | '' | null;
  auto_sync_stock: boolean;
  is_active: boolean;
}

export const ShopifySettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const activeEcommercePlatform = useAuthStore((s) => s.user?.active_ecommerce_platform);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const [shopDomain, setShopDomain] = useState('');
  const [authMode, setAuthMode] = useState<ShopifyAuthMode>(ShopifyAuthMode.ACCESS_TOKEN);
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [defaultBranchId, setDefaultBranchId] = useState<number | ''>('');
  const [autoSyncStock, setAutoSyncStock] = useState(true);
  const [autoSyncPrices, setAutoSyncPrices] = useState(false);
  const [autoSyncPromotions, setAutoSyncPromotions] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [importStock, setImportStock] = useState(false);
  const [mappings, setMappings] = useState<LocationMappingRow[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<'url' | 'secret' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      fetchMe();
      setFeedback({ type: 'success', message: 'تم ربط متجر Shopify عبر OAuth ومزامنة المواقع بنجاح!' });
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
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

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['shopify-settings'],
    queryFn: async () => (await apiClient.get('/shopify/settings')).data?.data,
  });

  useEffect(() => {
    if (!settings) return;
    setShopDomain(settings.shop_domain || '');
    setAuthMode((settings.auth_mode as ShopifyAuthMode) || ShopifyAuthMode.ACCESS_TOKEN);
    setClientId(settings.client_id || '');
    setDefaultBranchId(settings.default_branch_id || '');
    setAutoSyncStock(settings.auto_sync_stock ?? true);
    setAutoSyncPrices(settings.auto_sync_prices ?? false);
    setAutoSyncPromotions(settings.auto_sync_promotions ?? false);
    setIsActive(settings.is_active ?? true);
    setMappings(
      Array.isArray(settings.location_mappings)
        ? settings.location_mappings.map((m: any) => ({ ...m, branch_id: m.branch_id ?? '' }))
        : []
    );
  }, [settings]);

  const duplicateBranchIds = useMemo(() => {
    const counts = new Map<number, number>();
    mappings.forEach((m) => {
      if (m.branch_id) counts.set(Number(m.branch_id), (counts.get(Number(m.branch_id)) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([id]) => id));
  }, [mappings]);

  const notify = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/shopify/settings', {
        shop_domain: shopDomain.trim(),
        auth_mode: authMode,
        access_token: accessToken.trim() || undefined,
        client_id: clientId.trim() || undefined,
        client_secret: clientSecret.trim() || undefined,
        webhook_secret: webhookSecret.trim() || undefined,
        default_branch_id: defaultBranchId || null,
        auto_sync_stock: autoSyncStock,
        auto_sync_prices: autoSyncPrices,
        auto_sync_promotions: autoSyncPromotions,
        is_active: isActive,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
      fetchMe();
      setAccessToken('');
      setClientSecret('');
      setWebhookSecret('');
      notify('success', res.data?.message || 'تم حفظ إعدادات Shopify بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل حفظ الإعدادات'),
  });

  const testMutation = useMutation({
    mutationFn: () => apiClient.post('/shopify/test-connection'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
      notify('success', res.data?.message || 'تم الاتصال بمتجر Shopify بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل اختبار الاتصال'),
  });

  const syncLocationsMutation = useMutation({
    mutationFn: () => apiClient.post('/shopify/sync-locations'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
      notify('success', res.data?.message || 'تم جلب مواقع المخزون من Shopify');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل جلب المواقع'),
  });

  const registerWebhooksMutation = useMutation({
    mutationFn: () => apiClient.post('/shopify/register-webhooks'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
      notify('success', res.data?.message || 'تم تسجيل الـ Webhooks بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'تعذر تسجيل بعض الـ Webhooks'),
  });

  const saveMappingsMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/shopify/location-mappings', {
        mappings: mappings.map((m) => ({
          id: m.id,
          branch_id: m.branch_id ? Number(m.branch_id) : null,
          auto_sync_stock: Boolean(m.branch_id) && m.auto_sync_stock,
        })),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
      notify('success', res.data?.message || 'تم حفظ ربط المواقع بالمخازن بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل حفظ ربط المواقع'),
  });

  const importProductsMutation = useMutation({
    mutationFn: () => apiClient.post('/shopify/import-products', { import_stock: importStock }),
    onSuccess: (res) => notify('success', res.data?.message || 'تم بدء استيراد منتجات Shopify'),
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل استيراد المنتجات'),
  });

  const pushStocksMutation = useMutation({
    mutationFn: () => apiClient.post('/shopify/push-all-stocks'),
    onSuccess: (res) => notify('success', res.data?.message || 'تم دفع الأرصدة إلى مواقع Shopify بنجاح'),
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل دفع الأرصدة'),
  });

  const pushPricesMutation = useMutation({
    mutationFn: () => apiClient.post('/shopify/push-all-prices'),
    onSuccess: (res) => notify('success', res.data?.message || 'تم دفع الأسعار وسعر العرض إلى Shopify بنجاح'),
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشل دفع الأسعار إلى Shopify'),
  });

  const syncPromotionsMutation = useMutation({
    mutationFn: () => apiClient.post('/shopify/sync-promotions'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      notify('success', res.data?.message || 'تمت مزامنة الكوبونات والعروض مع Shopify بنجاح');
    },
    onError: (err: any) => notify('error', err.response?.data?.message || 'فشلت مزامنة العروض من Shopify'),
  });

  const handleOAuthConnect = async () => {
    if (!shopDomain.trim()) {
      notify('error', 'يرجى إدخال نطاق متجر Shopify أولاً (my-store.myshopify.com)');
      return;
    }
    try {
      const returnUrl = `${window.location.origin}/shopify?auth=success`;
      const res = await apiClient.get('/shopify/authorize-url', { params: { shop_domain: shopDomain.trim(), return_url: returnUrl } });
      if (res.data?.authorize_url) window.location.href = res.data.authorize_url;
    } catch (err: any) {
      notify('error', err.response?.data?.message || 'فشل إنشاء رابط OAuth');
    }
  };

  const handleSaveMappings = () => {
    if (duplicateBranchIds.size > 0) {
      notify('error', 'لا يمكن ربط أكثر من موقع Shopify بنفس المخزن/الفرع لمنع تضاعف الأرصدة.');
      return;
    }
    saveMappingsMutation.mutate();
  };

  const copyText = (value: string, key: 'url' | 'secret') => {
    navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="تكامل متجر Shopify (GraphQL 2026-10)"
        description="ربط موثّق مع POS كمصدر وحيد للمخزون، دعم المواقع المتعددة (1-to-1)، واستيراد الكتالوج والطلبات"
        badge={
          <Badge tone={settings?.is_active ? 'ok' : 'neutral'} dot>
            {settings?.is_active ? 'متصل ونشط' : 'غير مفعل'}
          </Badge>
        }
      />

      {activeEcommercePlatform === EcommercePlatform.WOOCOMMERCE && (
        <div className="p-4 rounded-2xl border bg-warn-soft border-warn/30 text-warn flex items-center gap-3 text-xs font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            متجر WooCommerce مربوط ومفعّل حالياً. يدعم النظام منصة متجر إلكتروني واحدة فقط؛ قم بتعطيل تفعيل WooCommerce أولاً إذا أردت التحويل إلى Shopify.
          </span>
        </div>
      )}

      {settings?.last_error && (
        <div
          className={
            settings.last_error.includes('write_products') || settings.last_error.includes('write_discounts')
              ? 'p-4 rounded-2xl border bg-warn-soft border-warn/30 text-warn flex items-start gap-3 text-xs font-bold'
              : 'p-4 rounded-2xl border bg-bad-soft border-bad/25 text-bad flex items-start gap-3 text-xs font-bold'
          }
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-black">
              {settings.last_error.includes('write_products') || settings.last_error.includes('write_discounts')
                ? 'يلزم تحديث صلاحيات متجر Shopify (إعادة الربط):'
                : 'آخر تنبيه/خطأ في المزامنة:'}
            </p>
            <p className="mt-0.5 font-medium">{settings.last_error}</p>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold ${feedback.type === 'success' ? 'bg-ok-soft border-ok/20 text-ok' : 'bg-bad-soft border-bad/20 text-bad'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-ink">1. إعدادات الربط والاعتماد (Authentication)</h2>
            {isLoading && <span className="text-xs text-muted">جاري التحميل...</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="نطاق متجر Shopify (Shop Domain)"
              placeholder="my-store.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
            />
            <Select
              label="طريقة المصادقة (Auth Mode)"
              value={authMode}
              onChange={(e) => setAuthMode(e.target.value as ShopifyAuthMode)}
              options={[
                { value: ShopifyAuthMode.ACCESS_TOKEN, label: 'رمز وصول مباشر (Access Token / shpat_)' },
                { value: ShopifyAuthMode.CLIENT_CREDENTIALS, label: 'Dev Dashboard 2026 (Client Credentials)' },
                { value: ShopifyAuthMode.OAUTH, label: 'ربط OAuth 2.0 التلقائي' },
              ]}
            />
          </div>

          {authMode === ShopifyAuthMode.ACCESS_TOKEN && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={`Access Token ${settings?.access_token_preview ? `(المحفوظ: ${settings.access_token_preview})` : ''}`}
                name="shopify_access_token"
                type="password"
                autoComplete="new-password"
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <Input
                label="Webhook Signing Secret (اختياري للربط اليدوي)"
                name="shopify_webhook_secret"
                type="password"
                autoComplete="new-password"
                placeholder="من Shopify Notifications > Webhooks"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
            </div>
          )}

          {authMode === ShopifyAuthMode.CLIENT_CREDENTIALS && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Client ID" name="shopify_client_id" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="من Shopify Dev Dashboard" />
              <Input
                label={`Client Secret ${settings?.has_client_secret ? '(محفوظ)' : ''}`}
                name="shopify_client_secret"
                type="password"
                autoComplete="new-password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
          )}

          {authMode === ShopifyAuthMode.OAUTH && (
            <div className="p-4 rounded-2xl bg-brand-soft border border-brand/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs font-bold text-ink">اضغط للانتقال إلى لوحة Shopify ومنح الصلاحيات وتوليد المفاتيح تلقائياً.</p>
              <Button variant="primary" size="sm" onClick={handleOAuthConnect}>
                <Zap className="w-4 h-4 ml-1" /> ربط عبر Shopify OAuth
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="الفرع الافتراضي للطلبات غير المربوطة بموقع"
              value={defaultBranchId}
              onChange={(e) => setDefaultBranchId(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: 'الفرع الرئيسي تلقائياً' },
                ...branches.map((b: any) => ({ value: b.id, label: b.name })),
              ]}
            />
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={autoSyncStock} onChange={(e) => setAutoSyncStock(e.target.checked)} />
                مزامنة المخزون لحظياً من POS إلى Shopify عند كل حركة
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={autoSyncPrices} onChange={(e) => setAutoSyncPrices(e.target.checked)} />
                مزامنة الأسعار وسعر العرض تلقائياً (POS → Shopify)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={autoSyncPromotions} onChange={(e) => setAutoSyncPromotions(e.target.checked)} />
                مزامنة الكوبونات وعروض الكميات تلقائياً (ثنائية الاتجاه)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                تفعيل التكامل واستقبال الطلبات
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="primary" isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              حفظ الإعدادات
            </Button>
            <Button variant="secondary" isLoading={testMutation.isPending} onClick={() => testMutation.mutate()}>
              <RefreshCw className="w-4 h-4 ml-1" /> اختبار الاتصال ومزامنة المواقع
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-base font-black text-ink">2. المزامنة والكتالوج والـ Webhooks</h2>
          <p className="text-xs text-muted leading-relaxed">
            الأصناف المربوطة حالياً: <strong className="text-ink">{settings?.linked_products_count ?? 0}</strong> صنف
          </p>

          <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer p-3 rounded-xl bg-canvas border border-line">
            <input type="checkbox" checked={importStock} onChange={(e) => setImportStock(e.target.checked)} />
            استيراد رصيد البداية من مواقع Shopify للأصناف ذات الرصيد الصفري
          </label>

          <Button className="w-full" variant="secondary" isLoading={importProductsMutation.isPending} onClick={() => importProductsMutation.mutate()}>
            <Download className="w-4 h-4 ml-1" /> استيراد وتحديث المنتجات من Shopify
          </Button>
          <Button className="w-full" variant="secondary" isLoading={pushStocksMutation.isPending} onClick={() => pushStocksMutation.mutate()}>
            <Warehouse className="w-4 h-4 ml-1" /> دفع كافة الأرصدة لمواقع Shopify
          </Button>
          <Button className="w-full" variant="secondary" isLoading={pushPricesMutation.isPending} onClick={() => pushPricesMutation.mutate()}>
            <DollarSign className="w-4 h-4 ml-1" /> دفع كل الأسعار لشوبيفاي
          </Button>
          <Button className="w-full" variant="secondary" isLoading={syncPromotionsMutation.isPending} onClick={() => syncPromotionsMutation.mutate()}>
            <Tag className="w-4 h-4 ml-1" /> سحب كوبونات وعروض شوبيفاي
          </Button>
          <Button className="w-full" variant="secondary" isLoading={registerWebhooksMutation.isPending} onClick={() => registerWebhooksMutation.mutate()}>
            <Webhook className="w-4 h-4 ml-1" /> تسجيل / تحديث الـ Webhooks تلقائياً
          </Button>

          {settings?.webhook_registered_at && (
            <p className="text-[11px] font-bold text-ok">
              ✓ آخر تسجيل ناجح للـ Webhooks: {new Date(settings.webhook_registered_at).toLocaleString('ar-EG')}
            </p>
          )}

          {settings?.webhook_url && (
            <div className="space-y-2 pt-3 border-t border-line text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-muted">Webhook URL</span>
                <button type="button" onClick={() => copyText(settings.webhook_url, 'url')} className="text-brand font-bold flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5" /> {copiedKey === 'url' ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>
              <div className="p-2 rounded-lg bg-canvas border border-line text-[11px] font-mono break-all text-muted">{settings.webhook_url}</div>
              {settings?.webhook_secret && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-bold text-muted">Webhook Secret</span>
                  <button type="button" onClick={() => copyText(settings.webhook_secret, 'secret')} className="text-brand font-bold flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5" /> {copiedKey === 'secret' ? 'تم النسخ' : 'نسخ'}
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-base font-black text-ink">3. ربط مواقع Shopify بالمخازن والفروع (1-to-1 Mapping)</h2>
              <p className="text-xs text-muted">كل موقع Shopify يُربط بمخزن مستقل (يُمنع ربط موقعين بنفس المخزن لمنع تضاعف الأرصدة)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" isLoading={syncLocationsMutation.isPending} onClick={() => syncLocationsMutation.mutate()}>
              <RefreshCw className="w-4 h-4 ml-1" /> تحديث المواقع
            </Button>
            <Button variant="primary" size="sm" disabled={mappings.length === 0 || duplicateBranchIds.size > 0} isLoading={saveMappingsMutation.isPending} onClick={handleSaveMappings}>
              حفظ الربط
            </Button>
          </div>
        </div>

        {duplicateBranchIds.size > 0 && (
          <div className="p-3 rounded-xl border border-bad/30 bg-bad-soft text-bad text-xs font-bold">
            يوجد مخزن مرتبط بأكثر من موقع Shopify في الجدول أدناه — يرجى اختيار مخزن مستقل لكل موقع قبل الحفظ.
          </div>
        )}

        {mappings.length === 0 ? (
          <div className="p-6 text-center text-xs font-bold text-muted bg-canvas rounded-2xl border border-line">
            لا توجد مواقع مسحوبة بعد. اضغط &quot;اختبار الاتصال ومزامنة المواقع&quot; أو &quot;تحديث المواقع&quot; لجلب مواقع متجر Shopify.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2.5 px-3">موقع Shopify</th>
                  <th className="py-2.5 px-3">الحالة</th>
                  <th className="py-2.5 px-3">معرّف الموقع</th>
                  <th className="py-2.5 px-3">الفرع / المخزن المقابل</th>
                  <th className="py-2.5 px-3">مزامنة المخزون</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, idx) => (
                  <tr key={m.id} className="border-b border-line/60">
                    <td className="py-2.5 px-3 font-bold text-ink">{m.shopify_location_name}</td>
                    <td className="py-2.5 px-3">
                      <Badge tone={m.is_active ? 'ok' : 'neutral'}>{m.is_active ? 'نشط' : 'معطّل'}</Badge>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-muted">{m.shopify_location_id}</td>
                    <td className="py-2.5 px-3 min-w-[220px]">
                      <Select
                        value={m.branch_id ?? ''}
                        onChange={(e) => {
                          const branchVal = e.target.value ? Number(e.target.value) : '';
                          const next = [...mappings];
                          next[idx] = { ...m, branch_id: branchVal, auto_sync_stock: Boolean(branchVal) && m.auto_sync_stock };
                          setMappings(next);
                        }}
                        options={[
                          { value: '', label: 'بدون ربط (تجاهل هذا الموقع)' },
                          ...branches.map((b: any) => ({ value: b.id, label: b.name })),
                        ]}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!m.branch_id}
                          checked={Boolean(m.branch_id) && m.auto_sync_stock}
                          onChange={(e) => {
                            const next = [...mappings];
                            next[idx] = { ...m, auto_sync_stock: e.target.checked };
                            setMappings(next);
                          }}
                        />
                        تفعيل
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
