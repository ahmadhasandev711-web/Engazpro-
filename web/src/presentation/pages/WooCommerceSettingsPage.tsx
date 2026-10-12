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
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { useHaptic } from '../hooks/useHaptic';

export const WooCommerceSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success } = useHaptic();

  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [onlineBranchId, setOnlineBranchId] = useState<number | ''>('');
  const [autoSyncStock, setAutoSyncStock] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isConnectingOneClick, setIsConnectingOneClick] = useState(false);
  const [importStockWithProducts, setImportStockWithProducts] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check URL params for OAuth redirect success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setFeedback({
        type: 'success',
        message: 'تم ربط متجر ووكومرس بنجاح وتفعيل المزامنة التلقائية! 🎉',
      });
      queryClient.invalidateQueries({ queryKey: ['woocommerce-settings'] });
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
    }
  }, [settingsData]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        store_url: storeUrl,
        online_branch_id: onlineBranchId || null,
        auto_sync_stock: autoSyncStock,
        is_active: true,
      };
      if (consumerKey) payload.consumer_key = consumerKey;
      if (consumerSecret) payload.consumer_secret = consumerSecret;

      return apiClient.post('/woocommerce/settings', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['woocommerce-settings'] });
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
      setFeedback({ type: 'success', message: res.data?.message || 'تم تحديث أرصدة كافة المنتجات في متجرك بنجاح 🟢' });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشلت مزامنة أرصدة المنتجات مع ووكومرس' });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  const isConnected = Boolean(settingsData?.is_active && settingsData?.store_url);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
            <Globe className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">ربط متجر ووكومرس (WooCommerce)</h1>
              {isConnected ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  متصل ونشط
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  غير مربوط
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              إدارة الربط لمزامنة المنتجات وسحب الطلبات ومزامنة العملاء في الوقت الفعلي
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${testMutation.isPending ? 'animate-spin' : ''}`} />
              <span>فحص الاتصال بالمتجر</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          )}
          <span className="text-xs font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form & Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1-Click WooCommerce Connect Card */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-3xl shadow-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <span>الربط السريع بضغطة زر واحدة (1-Click Connect)</span>
                  <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 font-bold">
                    موصى به
                  </span>
                </h2>
                <p className="text-xs text-indigo-200 mt-0.5">
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
                className="flex-1 bg-slate-950/70 border border-indigo-700/60 rounded-xl px-3.5 py-2.5 text-white placeholder-indigo-300/50 text-xs font-mono focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleOneClickConnect}
                disabled={isConnectingOneClick || !storeUrl.trim()}
                className="bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer shrink-0"
              >
                <Zap className={`w-4 h-4 ${isConnectingOneClick ? 'animate-spin' : ''}`} />
                <span>{isConnectingOneClick ? 'جاري التوجيه...' : 'ربط المتجر بضغطة واحدة 🚀'}</span>
              </button>
            </div>
          </div>

          {/* API Credentials Card (Manual / Advanced) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>الربط اليدوي المتقدم (API Keys)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">خيار بديل</span>
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رابط المتجر الإلكتروني (Store URL) *
                </label>
                <input
                  type="url"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://myfashionstore.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-primary-500"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Consumer Key (مفتاح العميل)
                  </label>
                  <input
                    type="password"
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                    placeholder={settingsData?.consumer_key_preview || 'ck_xxxxxxxxxxxx'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-primary-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Consumer Secret (المفتاح السري)
                  </label>
                  <input
                    type="password"
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                    placeholder="cs_xxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-none focus:ring-2 focus:ring-primary-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                💡 يمكنك توليد المفاتيح من لوحة تحكم ووردبريس: <span className="font-mono">WooCommerce &gt; Settings &gt; Advanced &gt; REST API</span> مع إعطاء صلاحيات <span className="font-bold">Read/Write</span>.
              </p>
            </div>
          </div>

          {/* Sync Rules Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Warehouse className="w-4 h-4 text-emerald-600" />
              <span>إعدادات الفروع وتوجيه المخزون</span>
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الفرع أو المخزن الافتراضي للأونلاين:
                </label>
                <select
                  value={onlineBranchId}
                  onChange={(e) => setOnlineBranchId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- الفرع الرئيسي الافتراضي --</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type === 'WAREHOUSE' ? 'مستودع' : b.type === 'STORE' ? 'متجر' : 'سيارة'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  تُسند الطلبات الواردة إلى هذا المخزن لتجهيزها، ويمكن إعادة توجيه أي طلب لأي فرع لاحقاً.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    مزامنة المخزون تلقائياً لووكومرس (Auto Stock Push)
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    عند حدوث أي عملية بيع في المحل أو الكاشير، يتم تحديث رصيد الصنف والمتغير على ووكومرس فورياً.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSyncStock}
                  onChange={(e) => setAutoSyncStock(e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded-lg focus:ring-primary-500"
                />
              </div>

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !storeUrl}
                className="w-full py-3 bg-primary-600 text-slate-950 font-black rounded-xl text-xs hover:bg-primary-500 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>حفظ وتفعيل إعدادات الربط</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions & Webhook Setup */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>إجراءات المزامنة الفورية</span>
            </h2>

            <div className="space-y-2.5">
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2.5">
                <button
                  onClick={() => importProductsMutation.mutate()}
                  disabled={importProductsMutation.isPending || !isConnected}
                  className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-right transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
                      <Download className={`w-4 h-4 ${importProductsMutation.isPending ? 'animate-bounce' : ''}`} />
                    </div>
                    <div>
                      <span className="text-xs font-black text-white block">استيراد الأصناف من ووكومرس</span>
                      <span className="text-[10px] text-indigo-100 block">سحب المنتجات والمقاسات والألوان لإنجاز برو</span>
                    </div>
                  </div>
                </button>

                <label className="flex items-center gap-2 cursor-pointer pt-0.5 px-1">
                  <input
                    type="checkbox"
                    checked={importStockWithProducts}
                    onChange={(e) => setImportStockWithProducts(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-[11px] font-bold text-slate-700 select-none">
                    استيراد كميات المخزون كرصيد أول مدة (INITIAL)
                  </span>
                </label>
              </div>

              <button
                onClick={() => syncCustomersMutation.mutate()}
                disabled={syncCustomersMutation.isPending || !isConnected}
                className="w-full p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-right hover:bg-emerald-100/70 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Users className={`w-4 h-4 ${syncCustomersMutation.isPending ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-emerald-950 block">استيراد عملاء المتجر إلى إنجاز برو</span>
                    <span className="text-[10px] text-slate-500 block">سحب عملاء ووكومرس لبناء قاعدة بيانات تسويقية</span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => pushAllStocksMutation.mutate()}
                disabled={pushAllStocksMutation.isPending || !isConnected}
                className="w-full p-3.5 bg-purple-50 border border-purple-200/80 rounded-2xl text-right hover:bg-purple-100/70 transition-all group disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                    <RefreshCw className={`w-4 h-4 ${pushAllStocksMutation.isPending ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-purple-950 block">مزامنة أرصدة كافة المنتجات مع المتجر (Bulk Push)</span>
                    <span className="text-[10px] text-slate-500 block">إرسال وتحديث كميات كافة الأصناف المرتبطة مباشرة في ووردبريس فوراً</span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => registerWebhooksMutation.mutate()}
                disabled={registerWebhooksMutation.isPending || !isConnected}
                className="w-full p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-right hover:bg-amber-100/70 transition-all group disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                    <Zap className={`w-4 h-4 ${registerWebhooksMutation.isPending ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-amber-950 block">تفعيل استقبال الطلبات اللحظية (Webhooks)</span>
                    <span className="text-[10px] text-slate-500 block">تسجيل الـ Webhook في وردبريس تلقائياً بدون تدخل يدوي</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Webhooks Setup Guide Card */}
          {settingsData?.webhook_url && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-black">الاستقبال اللحظي للطلبيات (Webhooks)</h3>
              </div>

              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5 text-emerald-300 text-[11px] leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>مفعل تلقائياً ⚡:</strong> يتم تسجيل وتفعيل خطاف الويب في متجرك بوردبريس أوتوماتيكياً بمجرد ربط المتجر. لا يحتاج العميل لنسخ أو لصق أي بيانات يدوياً.
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                البيانات أدناه للمطورين أو للربط اليدوي البديل فقط (اختياري):
              </p>

              <div className="space-y-2 pt-1 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Webhook URL:</span>
                  <div className="flex items-center gap-1 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="font-mono text-[10px] text-slate-200 truncate flex-1" dir="ltr">
                      {settingsData.webhook_url}
                    </span>
                    <button
                      onClick={() => copyToClipboard(settingsData.webhook_url, 'webhook')}
                      className="p-1 hover:bg-slate-700 rounded text-slate-300"
                    >
                      {copiedWebhook ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Secret:</span>
                  <div className="flex items-center gap-1 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="font-mono text-[10px] text-slate-200 truncate flex-1" dir="ltr">
                      {settingsData.webhook_secret}
                    </span>
                    <button
                      onClick={() => copyToClipboard(settingsData.webhook_secret, 'secret')}
                      className="p-1 hover:bg-slate-700 rounded text-slate-300"
                    >
                      {copiedSecret ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[10px] text-amber-300 block">
                    ⚡ الحدث في ووكومرس (Topic): <span className="font-mono font-bold">Order created</span> و <span className="font-mono font-bold">Order updated</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
