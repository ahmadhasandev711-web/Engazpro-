import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Warehouse,
  Webhook,
  Zap,
} from 'lucide-react';
import { EcommercePlatform } from '@pos-mandob/shared';
import { useEasyOrdersSettings } from '../../hooks/useEasyOrdersSettings';
import { Badge, Button, Card, Input, PageHeader, Select } from '../components/ui';

export const EasyOrdersSettingsPage: React.FC = () => {
  const eo = useEasyOrdersSettings();
  const [copiedField, setCopiedField] = useState<'orders' | 'status' | 'secret' | null>(null);

  const handleCopy = (key: 'orders' | 'status' | 'secret', value?: string | null) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    window.setTimeout(() => setCopiedField(null), 2000);
  };

  const hasConflict =
    Boolean(eo.activeEcommercePlatform) && eo.activeEcommercePlatform !== EcommercePlatform.EASYORDERS;

  const branchOptions = [
    { value: '', label: 'الفرع الرئيسي الافتراضي' },
    ...eo.branches.map((b: any) => ({ value: String(b.id), label: `${b.name} (${b.code})` })),
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
      <PageHeader
        title="ربط متجر EasyOrders"
        description="اربط متجرك على EasyOrders بضغطة واحدة أو بمفتاح API لمزامنة المخزون، الطلبات، والاستبدال الذكي تلقائياً."
        actions={
          eo.settings?.is_active ? (
            <Badge tone="ok" dot>
              الربط مفعّل ({eo.settings.store_name || 'EasyOrders'})
            </Badge>
          ) : (
            <Badge tone="neutral">غير مفعّل</Badge>
          )
        }
      />

      {eo.feedback && (
        <div
          className={`flex items-center gap-2.5 p-4 rounded-2xl border text-sm font-bold ${
            eo.feedback.type === 'success'
              ? 'bg-ok-soft border-ok/30 text-ok'
              : 'bg-bad-soft border-bad/30 text-bad'
          }`}
        >
          {eo.feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{eo.feedback.message}</span>
        </div>
      )}

      {hasConflict && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border bg-warn-soft border-warn/30 text-warn text-xs font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            منصة ({eo.activeEcommercePlatform}) مفعّلة حالياً. يدعم النظام منصة متجر إلكتروني واحدة فقط في نفس الوقت؛ قم بإلغاء تفعيلها أولاً قبل تفعيل EasyOrders.
          </span>
        </div>
      )}

      {eo.settings?.last_error && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl border bg-bad-soft border-bad/30 text-bad text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div>آخر تنبيه مزامنة مسجل:</div>
            <div className="mt-1 font-normal">{eo.settings.last_error}</div>
          </div>
        </div>
      )}

      {/* One-Click Authorized App Install */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-brand" />
              <h2 className="text-base font-black text-ink">الربط السريع بضغطة واحدة (Authorized App)</h2>
              <Badge tone="brand">الأسهل والأسرع</Badge>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              افتح صفحة التفويض في EasyOrders ليتم توليد مفتاح API وتسجيل Webhooks الطلبات وتحديث الحالات تلقائياً بدون نسخ يدوي.
            </p>
          </div>
          <Button
            variant="primary"
            disabled={hasConflict}
            isLoading={eo.installLinkMutation.isPending}
            onClick={() => eo.installLinkMutation.mutate()}
            leftIcon={<ExternalLink className="w-4 h-4" />}
            className="shrink-0"
          >
            ربط متجر EasyOrders الآن
          </Button>
        </div>
      </Card>

      {/* Manual Settings & Webhooks */}
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            eo.saveMutation.mutate();
          }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <h2 className="text-base font-black text-ink">بيانات الربط والإعدادات اليدوية (Public API Key)</h2>
            {eo.isLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="اسم المتجر (اختياري)"
              value={eo.storeName}
              onChange={(e) => eo.setStoreName(e.target.value)}
              placeholder="مثال: متجر لوفا على إيزي أوردر"
            />
            <Input
              label="معرّف المتجر Store ID (اختياري)"
              dir="ltr"
              value={eo.storeId}
              onChange={(e) => eo.setStoreId(e.target.value)}
              placeholder="UUID من إعدادات EasyOrders"
            />
            <Input
              label="مفتاح Api-Key"
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={eo.apiKey}
              onChange={(e) => eo.setApiKey(e.target.value)}
              placeholder={eo.settings?.has_api_key ? '•••••••• (محفوظ — اتركه فارغاً للإبقاء)' : 'الصق Api-Key من لوحة EasyOrders'}
            />
            <Input
              label="Webhook Secret"
              dir="ltr"
              value={eo.webhookSecret}
              onChange={(e) => eo.setWebhookSecret(e.target.value)}
              placeholder="سيُنشأ تلقائياً إن تُرك فارغاً"
              rightIcon={
                eo.webhookSecret ? (
                  <button type="button" onClick={() => handleCopy('secret', eo.webhookSecret)} aria-label="نسخ السر">
                    <Copy className="w-4 h-4 text-muted hover:text-ink" />
                  </button>
                ) : undefined
              }
            />
            <Select
              label="فرع سحب الطلبات ومزامنة المخزون"
              value={eo.defaultBranchId}
              onChange={(e) => eo.setDefaultBranchId(e.target.value ? Number(e.target.value) : '')}
              options={branchOptions}
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-1 text-xs font-bold text-ink">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={eo.isActive}
                onChange={(e) => eo.setIsActive(e.target.checked)}
              />
              تفعيل ربط EasyOrders
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={eo.autoSyncStock}
                onChange={(e) => eo.setAutoSyncStock(e.target.checked)}
              />
              مزامنة المخزون تلقائياً عند البيع أو التوريد أو الاستبدال
            </label>
          </div>

          {/* Webhook URLs Box */}
          {eo.settings?.webhooks && (
            <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-ink">
                <Webhook className="w-4 h-4 text-brand" />
                <span>روابط Webhooks للربط اليدوي (ضعها في Public API &gt; Webhooks)</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center justify-between gap-2 bg-panel p-2.5 rounded-xl border border-line">
                  <div className="min-w-0">
                    <span className="text-muted font-bold block">رابط استقبال الطلبات الجديدة:</span>
                    <code dir="ltr" className="text-ink font-mono break-all">{eo.settings.webhooks.orders_webhook}</code>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCopy('orders', eo.settings?.webhooks?.orders_webhook)}
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedField === 'orders' ? 'تم النسخ' : 'نسخ'}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 bg-panel p-2.5 rounded-xl border border-line">
                  <div className="min-w-0">
                    <span className="text-muted font-bold block">رابط تحديث حالات الطلبات:</span>
                    <code dir="ltr" className="text-ink font-mono break-all">{eo.settings.webhooks.order_status_webhook}</code>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCopy('status', eo.settings?.webhooks?.order_status_webhook)}
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedField === 'status' ? 'تم النسخ' : 'نسخ'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              isLoading={eo.testMutation.isPending}
              onClick={() => eo.testMutation.mutate()}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              اختبار الاتصال
            </Button>
            <Button type="submit" variant="primary" isLoading={eo.saveMutation.isPending}>
              حفظ الإعدادات
            </Button>
          </div>
        </form>
      </Card>

      {/* Sync Operations */}
      <Card>
        <div className="space-y-4">
          <div className="border-b border-line pb-3">
            <h2 className="text-base font-black text-ink">أدوات المزامنة اليدوية والتهيئة الأولية</h2>
            <p className="text-xs text-muted mt-0.5">
              استورد منتجاتك بمتغيراتها وأكواد الـ SKU من EasyOrders، أو ادفع أرصدة الفروع فوراً (مع مراعاة حد 40 طلب/دقيقة في EasyOrders).
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={eo.importStock}
              onChange={(e) => eo.setImportStock(e.target.checked)}
            />
            استيراد الكميات الحالية من EasyOrders كرصيد افتتاحي للأصناف الجديدة فقط
          </label>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              isLoading={eo.importProductsMutation.isPending}
              onClick={() => eo.importProductsMutation.mutate()}
              leftIcon={<Download className="w-4 h-4 text-brand" />}
            >
              استيراد المنتجات والمتغيرات
            </Button>
            <Button
              variant="secondary"
              isLoading={eo.pullOrdersMutation.isPending}
              onClick={() => eo.pullOrdersMutation.mutate()}
              leftIcon={<RefreshCw className="w-4 h-4 text-brand" />}
            >
              سحب أحدث الطلبات
            </Button>
            <Button
              variant="secondary"
              isLoading={eo.pushAllStocksMutation.isPending}
              onClick={() => eo.pushAllStocksMutation.mutate()}
              leftIcon={<Warehouse className="w-4 h-4 text-ok" />}
            >
              دفع أرصدة كل الأصناف إلى EasyOrders
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
