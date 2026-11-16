import React, { useState, useEffect } from 'react';
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
  const [shopDomain, setShopDomain] = useState('');
  const [authMode, setAuthMode] = useState<ShopifyAuthMode>(ShopifyAuthMode.ACCESS_TOKEN);
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [defaultBranchId, setDefaultBranchId] = useState<number | ''>('');
  const [autoSyncStock, setAutoSyncStock] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [importStock, setImportStock] = useState(false);
  const [mappings, setMappings] = useState<LocationMappingRow[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<'url' | 'secret' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      useAuthStore.getState().fetchMe();
      setFeedback({ type: 'success', message: 'تم ربط متجر Shopify عبر OAuth ومزامنة المواقع بنجاح!' });
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [queryClient]);

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
    setIsActive(settings.is_active ?? true);
    setMappings(
      Array.isArray(settings.location_mappings)
        ? settings.location_mappings.map((m: any) => ({ ...m, branch_id: m.branch_id ?? '' }))
        : []
    );
  }, [settings]);

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
        default_branch_id: defaultBranchId || null,
        auto_sync_stock: autoSyncStock,
        is_active: isActive,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shopify-settings'] });
      useAuthStore.getState().fetchMe();
      setAccessToken('');
      setClientSecret('');
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

  const saveMappingsMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/shopify/location-mappings', {
        mappings: mappings.map((m) => ({
          id: m.id,
          branch_id: m.branch_id ? Number(m.branch_id) : null,
          auto_sync_stock: m.auto_sync_stock,
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

  const copyText = (value: string, key: 'url' | 'secret') => {
    navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="تكامل متجر Shopify (GraphQL 2026-10)"
        description="ربط ثنائي الاتجاه مع دعم المواقع المتعددة (Multi-Location)، استيراد الكتالوج والخصومات، ودفع المخزون اللحظي"
        badge={
          <Badge tone={settings?.is_active ? 'ok' : 'neutral'} dot>
            {settings?.is_active ? 'متصل ونشط' : 'غير مفعل'}
          </Badge>
        }
      />

      {useAuthStore.getState().user?.active_ecommerce_platform === EcommercePlatform.WOOCOMMERCE && (
        <div className="p-4 rounded-2xl border bg-warn-soft border-warn/30 text-warn flex items-center gap-3 text-xs font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            متجر WooCommerce مربوط ومفعّل حالياً. يدعم النظام منصة متجر إلكتروني واحدة فقط؛ قم بتعطيل تفعيل WooCommerce أولاً إذا أردت التحويل إلى Shopify.
          </span>
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

          {authMode === 'ACCESS_TOKEN' && (
            <Input
              label={`Access Token ${settings?.access_token_preview ? `(المحفوظ: ${settings.access_token_preview})` : ''}`}
              type="password"
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          )}

          {authMode === 'CLIENT_CREDENTIALS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="من Shopify Dev Dashboard" />
              <Input
                label={`Client Secret ${settings?.has_client_secret ? '(محفوظ)' : ''}`}
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
          )}

          {authMode === 'OAUTH' && (
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
                مزامنة المخزون لحظياً نحو مواقع Shopify عند كل حركة بيع/شراء
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
              <h2 className="text-base font-black text-ink">3. ربط مواقع Shopify بالمخازن والفروع (Location ↔ Branch Mapping)</h2>
              <p className="text-xs text-muted">ربط كل موقع على Shopify بالفرع/المخزن المقابل له في السيستم لدفع المخزون وتوجيه الطلبات بدقة</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" isLoading={syncLocationsMutation.isPending} onClick={() => syncLocationsMutation.mutate()}>
              <RefreshCw className="w-4 h-4 ml-1" /> تحديث المواقع
            </Button>
            <Button variant="primary" size="sm" disabled={mappings.length === 0} isLoading={saveMappingsMutation.isPending} onClick={() => saveMappingsMutation.mutate()}>
              حفظ الربط
            </Button>
          </div>
        </div>

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
                  <th className="py-2.5 px-3">معرّف الموقع</th>
                  <th className="py-2.5 px-3">الفرع / المخزن المقابل</th>
                  <th className="py-2.5 px-3">مزامنة المخزون</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, idx) => (
                  <tr key={m.id} className="border-b border-line/60">
                    <td className="py-2.5 px-3 font-bold text-ink">{m.shopify_location_name}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-muted">{m.shopify_location_id}</td>
                    <td className="py-2.5 px-3 min-w-[220px]">
                      <Select
                        value={m.branch_id ?? ''}
                        onChange={(e) => {
                          const next = [...mappings];
                          next[idx] = { ...m, branch_id: e.target.value ? Number(e.target.value) : '' };
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
                          checked={m.auto_sync_stock}
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
