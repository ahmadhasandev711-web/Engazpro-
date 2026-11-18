import React, { useState } from 'react';
import {
  Sparkles,
  PlusCircle,
  RefreshCw,
  Search,
  UserCheck,
  Copy,
  Check,
  Send,
  Ban,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { formatCurrency, formatDate, LicenseKey } from '@pos-mandob/shared';
import type { PublicPricingData } from '../../../hooks/usePublicPricing';
import type { UpdatePlatformPricingPayload } from '../../../hooks/useAdmin';
import { useConfirm } from '../../context/ConfirmContext';
import { Badge, Button, Card, DataTable, EmptyState, Input, Select } from '../ui';
import { PlatformPricingCard } from './PlatformPricingCard';
import clsx from 'clsx';

interface LicenseGeneratorTabProps {
  licenses: LicenseKey[];
  isLoading: boolean;
  totalLicenses: number;
  unusedCount: number;
  usedCount: number;
  revokedCount?: number;
  statusFilter: 'all' | 'unused' | 'used' | 'revoked';
  onStatusFilterChange: (s: 'all' | 'unused' | 'used' | 'revoked') => void;
  search: string;
  onSearchChange: (val: string) => void;
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  onGenerate: (payload: {
    count: number;
    duration_days: number;
    notes: string;
    price?: number | null;
    ecommerce_enabled?: boolean;
  }) => void;
  onRevokeLicense?: (licenseId: number) => void;
  isGenerating: boolean;
  pricing?: PublicPricingData;
  isSavingPricing?: boolean;
  onSavePricing?: (payload: UpdatePlatformPricingPayload) => Promise<void> | void;
}

const COUNT_OPTIONS = [
  { value: 1, label: '1 كود تفعيل فردي' },
  { value: 5, label: '5 أكواد' },
  { value: 10, label: '10 أكواد' },
  { value: 20, label: '20 كود' },
  { value: 50, label: '50 كود (دفعة توزيع)' },
  { value: 100, label: '100 كود' },
];

const DURATION_OPTIONS = [
  { value: 365, label: 'سنة كاملة (365 يوم) - القياسية' },
  { value: 30, label: 'شهر واحد (30 يوم)' },
  { value: 90, label: '3 شهور (90 يوم)' },
  { value: 180, label: '6 شهور (180 يوم)' },
  { value: 730, label: 'سنتين (730 يوم)' },
];

export const LicenseGeneratorTab: React.FC<LicenseGeneratorTabProps> = ({
  licenses,
  isLoading,
  totalLicenses,
  unusedCount,
  usedCount,
  revokedCount = 0,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  page,
  lastPage,
  onPageChange,
  onGenerate,
  onRevokeLicense,
  isGenerating,
  pricing,
  isSavingPricing = false,
  onSavePricing,
}) => {
  const { confirm } = useConfirm();
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [durationDays, setDurationDays] = useState<number>(365);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [ecommerceEnabled, setEcommerceEnabled] = useState<boolean>(false);
  const [batchNotes, setBatchNotes] = useState<string>('اشتراك سنوي (فودافون كاش / إنستاباي)');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const liveDefaultPrice = pricing
    ? (() => {
        const tier = ecommerceEnabled ? pricing.pro : pricing.basic;
        if (durationDays >= 365) return Math.round((tier.annual_price * durationDays) / 365);
        return Math.round((tier.monthly_price * durationDays) / 30);
      })()
    : null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleSendWhatsApp = (code: string, duration: number) => {
    const text = encodeURIComponent(
      `مرحباً بك في نظام *إنجاز برو* لإدارة الحسابات والمبيعات!\n\n` +
        `كود تفعيل اشتراكك الخاص هو:\n*${code}*\n\n` +
        `صالح لمدة: *${duration} يوم* (${duration >= 365 ? 'سنة كاملة' : `${duration} يوم`})\n\n` +
        `طريقة التفعيل:\n1. افتح نظام إنجاز برو.\n2. ادخل على الإعدادات -> تفعيل الاشتراك.\n3. الصق الكود واضغط تفعيل.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const confirmRevoke = async (license: LicenseKey) => {
    if (!onRevokeLicense) return;
    const ok = await confirm({
      title: 'إلغاء وحرق الكود',
      message: `هل أنت متأكد من إلغاء وحرق كود التفعيل (${license.code})؟ لن يتمكن أي عميل من استخدامه نهائياً.`,
      type: 'danger',
    });
    if (ok) onRevokeLicense(license.id);
  };

  const renderStatusBadge = (license: LicenseKey) => {
    if (license.is_revoked) {
      return (
        <Badge tone="warn">
          <Ban className="w-3 h-3" />
          ملغي
        </Badge>
      );
    }
    if (license.is_used) {
      return (
        <Badge tone="bad">
          <UserCheck className="w-3 h-3" />
          مستخدم
        </Badge>
      );
    }
    return (
      <Badge tone="ok" dot>
        متاح للبيع
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {pricing && onSavePricing && (
        <PlatformPricingCard
          pricing={pricing}
          isSaving={isSavingPricing}
          onSave={onSavePricing}
        />
      )}
      {/* Generate New Codes Card */}
      <Card className="border-brand/30 bg-panel space-y-5">
        <div className="border-b border-line pb-4">
          <div className="flex items-center gap-2 text-brand font-bold text-xs mb-1">
            <Sparkles className="w-4 h-4" />
            <span>توليد فوري ومؤمن للأكواد</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-ink">توليد دفعة أكواد تفعيل جديدة</h2>
          <p className="text-xs text-muted mt-1">
            يتم إنشاء أكواد مشفرة أحادية الاستخدام غير قابلة للتكرار أو التخمين.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select
            label="عدد الأكواد"
            value={generateCount}
            onChange={(e) => setGenerateCount(Number(e.target.value))}
            options={COUNT_OPTIONS}
          />
          <Select
            label="مدة الصلاحية"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            options={DURATION_OPTIONS}
          />
          <Input
            label="سعر الكود (اختياري)"
            type="number"
            min="0"
            step="0.01"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder={
              liveDefaultPrice !== null
                ? `الافتراضي: ${liveDefaultPrice} ج.م`
                : 'السعر الافتراضي للمنصة'
            }
          />
          <Input
            label="بيان الدفعة"
            type="text"
            value={batchNotes}
            onChange={(e) => setBatchNotes(e.target.value)}
            placeholder="مثال: فودافون كاش..."
          />
          <div className="flex items-end">
            <Button
              className="w-full"
              variant="primary"
              isLoading={isGenerating}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              onClick={() =>
                onGenerate({
                  count: generateCount,
                  duration_days: durationDays,
                  notes: batchNotes,
                  price: customPrice.trim() !== '' ? Number(customPrice) : null,
                  ecommerce_enabled: ecommerceEnabled,
                })
              }
            >
              توليد {generateCount} كود
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-2 border border-line text-xs font-bold text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ecommerceEnabled}
            onChange={(e) => setEcommerceEnabled(e.target.checked)}
            className="w-4 h-4 accent-brand rounded cursor-pointer"
          />
          <span>
            تضمين موديول المتجر الإلكتروني (WordPress / WooCommerce أو Shopify — السعر الافتراضي من التسعير الموحد:{' '}
            {pricing ? `${pricing.pro.monthly_price} ج/شهر أو ${pricing.pro.annual_price} ج/سنة` : 'حسب التسعير الموحد'})
          </span>
        </label>
      </Card>

      {/* Filters & Search */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:max-w-md">
            <Input
              leftIcon={<Search className="w-4 h-4" />}
              placeholder="ابحث بكود التفعيل أو الملاحظات أو اسم المشترك..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all' as const, label: `الكل (${totalLicenses})` },
              { key: 'unused' as const, label: `متاح (${unusedCount})` },
              { key: 'used' as const, label: `مستخدم (${usedCount})` },
              { key: 'revoked' as const, label: `ملغي (${revokedCount})` },
            ].map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => onStatusFilterChange(pill.key)}
                className={clsx(
                  'min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors border cursor-pointer',
                  statusFilter === pill.key
                    ? 'bg-brand text-on-brand border-brand'
                    : 'bg-surface-2 text-muted border-line hover:text-ink'
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
            جاري تحميل الأكواد...
          </div>
        ) : licenses.length === 0 ? (
          <EmptyState title="لا توجد أكواد مطابقة" description="جرّب تغيير الفلتر أو البحث بكود آخر." />
        ) : (
          <>
            {/* Desktop DataTable */}
            <DataTable className="hidden md:block">
              <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
                <tr>
                  <th className="px-5 py-3.5">كود التفعيل</th>
                  <th className="px-5 py-3.5">المدة والسعر</th>
                  <th className="px-5 py-3.5">الحالة</th>
                  <th className="px-5 py-3.5">الدفعة / الملاحظات</th>
                  <th className="px-5 py-3.5">تاريخ التوليد</th>
                  <th className="px-5 py-3.5">بيانات العميل</th>
                  <th className="px-5 py-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {licenses.map((license) => (
                  <tr key={license.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-ink">
                      <span className="bg-surface-2 px-2.5 py-1 rounded-lg border border-line select-all">
                        {license.code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-ink">{license.duration_days} يوم</div>
                      {license.price != null && (
                        <div className="text-[11px] text-brand font-bold mt-0.5 font-mono">
                          {formatCurrency(license.price)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{renderStatusBadge(license)}</td>
                    <td className="px-5 py-3.5 text-muted max-w-xs truncate">
                      <div className="text-ink font-medium flex items-center gap-1.5 flex-wrap">
                        <span>{license.notes || 'بدون ملاحظات'}</span>
                        {license.ecommerce_enabled && <Badge tone="brand">متجر إلكتروني</Badge>}
                      </div>
                      <div className="text-[11px] font-mono mt-0.5">{license.batch_reference}</div>
                    </td>
                    <td className="px-5 py-3.5 text-muted font-mono">{formatDate(license.created_at)}</td>
                    <td className="px-5 py-3.5">
                      {license.is_used && (license.used_by_user || license.used_by) ? (
                        <div>
                          <div className="font-bold text-ink">{(license.used_by_user || license.used_by)!.name}</div>
                          <div className="text-muted font-mono">{(license.used_by_user || license.used_by)!.phone}</div>
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopyCode(license.code)}
                          leftIcon={copiedCode === license.code ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                        >
                          {copiedCode === license.code ? 'نُسخ' : 'نسخ'}
                        </Button>
                        {!license.is_used && !license.is_revoked && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSendWhatsApp(license.code, license.duration_days)}
                              leftIcon={<Send className="w-3.5 h-3.5 text-ok" />}
                            >
                              واتساب
                            </Button>
                            {onRevokeLicense && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => confirmRevoke(license)}
                                leftIcon={<Ban className="w-3.5 h-3.5" />}
                              >
                                إلغاء
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {licenses.map((license) => (
                <div key={license.id} className="p-4 rounded-xl bg-surface-2 border border-line space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-ink bg-panel px-2.5 py-1 rounded-lg border border-line">
                      {license.code}
                    </span>
                    {renderStatusBadge(license)}
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>المدة: <strong className="text-ink">{license.duration_days} يوم</strong></span>
                    <span className="font-mono">{formatDate(license.created_at)}</span>
                  </div>
                  {license.notes && <p className="text-muted">{license.notes}</p>}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-line">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px] flex-1"
                      onClick={() => handleCopyCode(license.code)}
                      leftIcon={copiedCode === license.code ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copiedCode === license.code ? 'تم النسخ' : 'نسخ'}
                    </Button>
                    {!license.is_used && !license.is_revoked && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="min-h-[44px]"
                          onClick={() => handleSendWhatsApp(license.code, license.duration_days)}
                          leftIcon={<Send className="w-3.5 h-3.5 text-ok" />}
                        >
                          واتساب
                        </Button>
                        {onRevokeLicense && (
                          <Button
                            size="sm"
                            variant="danger"
                            className="min-h-[44px]"
                            onClick={() => confirmRevoke(license)}
                            leftIcon={<Ban className="w-3.5 h-3.5" />}
                          >
                            إلغاء
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {lastPage > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
                <span className="text-muted font-medium">
                  صفحة <strong className="text-ink">{page}</strong> من <strong className="text-ink">{lastPage}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                  >
                    السابق
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page >= lastPage}
                    onClick={() => onPageChange(page + 1)}
                    leftIcon={<ChevronLeft className="w-4 h-4" />}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};
