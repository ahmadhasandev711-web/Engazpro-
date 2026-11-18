import React, { useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { apiClient } from '../../../data/api/client';
import { Badge, Button, Input, Select, Textarea } from '../ui';

interface StoreInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLATFORM_OPTIONS = [
  { value: 'WordPress / WooCommerce', label: 'WordPress / WooCommerce' },
  { value: 'Shopify', label: 'Shopify' },
  { value: 'ترشيح الأنسب لنشاطي', label: 'أريد ترشيح الأنسب لنشاطي' },
];

const BUSINESS_TYPES = [
  { value: 'أزياء وملابس', label: 'أزياء وملابس' },
  { value: 'أحذية وشنط', label: 'أحذية وشنط' },
  { value: 'إلكترونيات وموبايلات', label: 'إلكترونيات وموبايلات' },
  { value: 'عطور ومستحضرات تجميل', label: 'عطور ومستحضرات تجميل' },
  { value: 'أدوات منزلية وديكور', label: 'أدوات منزلية وديكور' },
  { value: 'سوبرماركت وأغذية', label: 'سوبرماركت وأغذية' },
  { value: 'مطاعم وكافيهات', label: 'مطاعم وكافيهات' },
  { value: 'تجارة جملة وتوزيع', label: 'تجارة جملة وتوزيع' },
  { value: 'نشاط تجاري آخر', label: 'نشاط تجاري آخر' },
];

const SALES_WHATSAPP = import.meta.env.VITE_SALES_WHATSAPP || '201125030642';

/**
 * Modal form allowing visitors to request a custom WordPress or Shopify storefront integrated with EBMS.
 */
export const StoreInquiryModal: React.FC<StoreInquiryModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    platform: 'WordPress / WooCommerce',
    business_type: 'أزياء وملابس',
    city: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('يرجى كتابة الاسم ورقم الهاتف لنتواصل معك.');
      return;
    }

    setLoading(true);
    setError('');

    const combinedNotes = [
      `المنصة المفضلة: ${form.platform}`,
      form.notes.trim(),
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      await apiClient.post('/landing/inquiries', {
        name: form.name,
        phone: form.phone,
        business_type: form.business_type,
        city: form.city,
        notes: combinedNotes,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setError(apiErr?.response?.data?.message || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setSuccess(false);
    setError('');
    setForm({
      name: '',
      phone: '',
      platform: 'WordPress / WooCommerce',
      business_type: 'أزياء وملابس',
      city: '',
      notes: '',
    });
    onClose();
  };

  const handleWhatsAppRedirect = () => {
    const text = `مرحباً فريق إنجاز برو (EBMS)، قدمت طلباً لتصميم متجر إلكتروني مربوط بالكاشير:\nالاسم: ${form.name}\nرقم الهاتف: ${form.phone}\nالمنصة المطلوبة: ${form.platform}\nالنشاط: ${form.business_type}\nالمدينة: ${form.city || 'غير محددة'}\n${form.notes ? `ملاحظات: ${form.notes}` : ''}`;
    window.open(`https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-inquiry-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) resetAndClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-panel border border-line p-6 sm:p-8 shadow-2xl text-right max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={resetAndClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-xl border border-line bg-surface-2 text-muted hover:text-ink flex items-center justify-center transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-4 space-y-5">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-ok-soft border border-ok/25 text-ok">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h3 id="store-inquiry-title" className="text-xl sm:text-2xl font-black text-ink">
                تم استلام طلبك بنجاح
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                شكراً لك يا أستاذ <strong className="text-ink">{form.name}</strong>. تم تسجيل طلبك لتصميم المتجر الإلكتروني، وسيتواصل معك فريقنا خلال ساعات العمل لمناقشة التفاصيل وعرض النماذج.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button type="button" className="w-full sm:w-auto" onClick={handleWhatsAppRedirect}>
                <MessageCircle className="w-4 h-4" />
                <span>متابعة فورية عبر واتساب</span>
              </Button>
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={resetAndClose}>
                إغلاق النافذة
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pl-8">
              <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/25 text-brand flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone="brand">استشارة مجانية</Badge>
                  <span className="text-xs text-muted">خدمة تصميم وتطوير</span>
                </div>
                <h3 id="store-inquiry-title" className="text-lg sm:text-xl font-black text-ink">
                  طلب تصميم متجر إلكتروني مربوط بالكاشير
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              أدخل بياناتك وسيتواصل معك فريق التطوير لعرض نماذج المتاجر الحية ومناقشة تفاصيل الربط مع مخازن وكاشير إنجاز برو:
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-bad-soft border border-bad/25 text-bad-ink text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="الاسم بالكامل / اسم المسؤول *"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: أحمد عبد الله"
              />

              <Input
                label="رقم الموبايل أو الواتساب *"
                type="tel"
                dir="ltr"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01012345678"
              />

              <Select
                label="المنصة المطلوبة للمتجر"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                options={PLATFORM_OPTIONS}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="نوع النشاط التجاري"
                  value={form.business_type}
                  onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                  options={BUSINESS_TYPES}
                />

                <Input
                  label="المدينة / المحافظة"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="مثال: القاهرة، الإسكندرية..."
                />
              </div>

              <Textarea
                label="ملاحظات أو رابط صفحة السوشيال (اختياري)"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="كم صنف تقريباً تود عرضه؟ وهل لديك صفحة أو متجر حالي؟"
              />

              <div className="space-y-2.5 pt-1">
                <Button type="submit" size="lg" className="w-full" isLoading={loading}>
                  <Sparkles className="w-4 h-4" />
                  <span>إرسال طلب الاستشارة وتصميم المتجر</span>
                </Button>
                <div className="flex items-center justify-center gap-4 text-xs text-muted">
                  <span>بياناتك محمية تماماً</span>
                  <span>•</span>
                  <span>رد سريع خلال ساعات العمل</span>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
