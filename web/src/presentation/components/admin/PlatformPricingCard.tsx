import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Save, Tag } from 'lucide-react';
import type { PublicPricingData } from '../../../hooks/usePublicPricing';
import type { UpdatePlatformPricingPayload } from '../../../hooks/useAdmin';
import { Badge, Button, Card, Input } from '../ui';

interface PlatformPricingCardProps {
  pricing: PublicPricingData;
  isSaving: boolean;
  onSave: (payload: UpdatePlatformPricingPayload) => Promise<void> | void;
}

/**
 * Super-Admin pricing manager card: single source of truth for landing page and default license pricing.
 */
export const PlatformPricingCard: React.FC<PlatformPricingCardProps> = ({
  pricing,
  isSaving,
  onSave,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<UpdatePlatformPricingPayload>({
    basic_monthly_price: pricing.basic.monthly_price,
    basic_annual_price: pricing.basic.annual_price,
    pro_monthly_price: pricing.pro.monthly_price,
    pro_annual_price: pricing.pro.annual_price,
    trial_days: pricing.trial_days,
  });

  useEffect(() => {
    setForm({
      basic_monthly_price: pricing.basic.monthly_price,
      basic_annual_price: pricing.basic.annual_price,
      pro_monthly_price: pricing.pro.monthly_price,
      pro_annual_price: pricing.pro.annual_price,
      trial_days: pricing.trial_days,
    });
  }, [pricing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
    setIsOpen(false);
  };

  return (
    <Card className="border-line bg-panel space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-brand" />
            <h3 className="text-base font-black text-ink">تسعير الباقات والموقع العام (مصدر الحقيقة الوحيد)</h3>
            <Badge tone="brand">موحد</Badge>
          </div>
          <p className="text-xs text-muted">
            الأساسية: <strong className="text-ink font-mono">{pricing.basic.monthly_price} ج/شهر</strong> •{' '}
            <strong className="text-ink font-mono">{pricing.basic.annual_price} ج/سنة</strong>
            {' | '}
            المتاجر (برو): <strong className="text-ink font-mono">{pricing.pro.monthly_price} ج/شهر</strong> •{' '}
            <strong className="text-ink font-mono">{pricing.pro.annual_price} ج/سنة</strong>
            {' | '}
            تجربة مجانية: <strong className="text-ink font-mono">{pricing.trial_days} يوم</strong>
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setIsOpen((v) => !v)}
          rightIcon={isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        >
          {isOpen ? 'إخفاء التعديل' : 'تعديل أسعار المنصة'}
        </Button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="pt-4 border-t border-line space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input
              label="الأساسية — شهري (ج.م)"
              type="number"
              min="1"
              step="1"
              required
              value={form.basic_monthly_price}
              onChange={(e) => setForm({ ...form, basic_monthly_price: Number(e.target.value) })}
            />
            <Input
              label="الأساسية — سنوي (ج.م)"
              type="number"
              min="1"
              step="1"
              required
              value={form.basic_annual_price}
              onChange={(e) => setForm({ ...form, basic_annual_price: Number(e.target.value) })}
            />
            <Input
              label="المتاجر برو — شهري (ج.م)"
              type="number"
              min="1"
              step="1"
              required
              value={form.pro_monthly_price}
              onChange={(e) => setForm({ ...form, pro_monthly_price: Number(e.target.value) })}
            />
            <Input
              label="المتاجر برو — سنوي (ج.م)"
              type="number"
              min="1"
              step="1"
              required
              value={form.pro_annual_price}
              onChange={(e) => setForm({ ...form, pro_annual_price: Number(e.target.value) })}
            />
            <Input
              label="أيام التجربة المجانية"
              type="number"
              min="1"
              max="90"
              step="1"
              required
              value={form.trial_days}
              onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              حفظ وتحديث الموقع والأكواد فوراً
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};
