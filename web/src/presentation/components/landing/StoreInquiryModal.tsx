import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShoppingBag,
  MessageCircle,
  CheckCircle2,
  Phone,
  User,
  Building2,
  MapPin,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../../data/api/client';

interface StoreInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreInquiryModal: React.FC<StoreInquiryModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    business_type: 'أزياء وملابس',
    city: 'القاهرة',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('يرجى كتابة الاسم ورقم الهاتف للتواصل.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiClient.post('/landing/inquiries', form);
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'تعذر إرسال الطلب في الوقت الحالي. يمكنك التواصل معنا مباشرة عبر واتساب.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppRedirect = () => {
    const text = encodeURIComponent(
      `مرحباً، أنا ${form.name}. قمت بتقديم طلب لتصميم وتطوير متجر إلكتروني لنشاط (${form.business_type}) في (${form.city}). أود متابعة التفاصيل والعرض المتاح.`
    );
    window.open(`https://wa.me/201125030642?text=${text}`, '_blank');
    onClose();
  };

  const resetAndClose = () => {
    setSuccess(false);
    setError('');
    setForm({
      name: '',
      phone: '',
      business_type: 'أزياء وملابس',
      city: 'القاهرة',
      notes: '',
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in"
      dir="rtl"
    >
      <div
        className="w-full max-w-lg rounded-[32px] p-6 sm:p-8 relative border border-white/90 shadow-2xl transition-all"
        style={{
          background: 'linear-gradient(160deg, #FFFFFF, #F5F9FF 50%, #EDF4FE)',
          boxShadow: '0 25px 50px -12px rgba(14, 58, 46, 0.25), 0 0 0 1px rgba(255,255,255,0.8)',
        }}
      >
        {/* Close button */}
        <button
          onClick={resetAndClose}
          className="absolute top-5 left-5 p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/80 shadow-xs transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-6 space-y-5 animate-fade-in">
            <div
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-[#0E3A2E]"
              style={{
                backgroundImage: 'var(--gloss-jade)',
                boxShadow: 'var(--lift-jade), var(--lip-jade)',
              }}
            >
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-[#232D3C]">
                تم استلام طلبك بنجاح! 🎉
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                شكراً لك يا أستاذ <b className="text-[#0E3A2E]">{form.name}</b>.
                تم توجيه طلبك مباشرة إلى فريق تطوير وتصميم المتاجر. سيتواصل معك أحد مستشارينا خلال دقائق لمناقشة التفاصيل.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleWhatsAppRedirect}
                className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-black text-[#0E3A2E] transition-all flex items-center justify-center gap-2 active:scale-95"
                style={{
                  backgroundImage: 'var(--gloss-jade)',
                  boxShadow: 'var(--lift-jade)',
                }}
              >
                <MessageCircle className="w-4 h-4" />
                <span>متابعة فورية عبر واتساب</span>
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="w-full sm:w-auto px-5 py-3 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                تم، إغلاق النافذة
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#0E3A2E] shrink-0"
                style={{
                  backgroundImage: 'var(--gloss-jade)',
                  boxShadow: 'var(--lip-jade)',
                }}
              >
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black bg-[#B2E7D2] text-[#0E3A2E] px-2 py-0.5 rounded-full">
                    استشارة مجانية
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">| تصميم وتطوير</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#232D3C] mt-0.5">
                  طلب تصميم وبرمجة متجر إلكتروني
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed font-medium">
              أدخل بياناتك وسنتواصل معك لعرض نماذج المتاجر الحية ومناقشة تفاصيل الربط مع كاشير ومخازن إنجاز برو:
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#2A7A62]" />
                  <span>الاسم بالكامل / اسم المسؤول *</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7CCFB0] transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#2A7A62]" />
                  <span>رقم الموبايل أو الواتساب *</span>
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="01012345678"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7CCFB0] transition-all dir-ltr text-right"
                />
              </div>

              {/* Row: Business Type & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#2A7A62]" />
                    <span>نوع النشاط التجاري</span>
                  </label>
                  <select
                    value={form.business_type}
                    onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7CCFB0] transition-all"
                  >
                    <option value="أزياء وملابس">أزياء وملابس</option>
                    <option value="أحذية وشنط">أحذية وشنط</option>
                    <option value="إلكترونيات وموبايلات">إلكترونيات وموبايلات</option>
                    <option value="عطور ومستحضرات تجميل">عطور ومستحضرات تجميل</option>
                    <option value="أدوات منزلية وديكور">أدوات منزلية وديكور</option>
                    <option value="سوبرماركت وأغذية">سوبرماركت وأغذية</option>
                    <option value="مطاعم وكافيهات">مطاعم وكافيهات</option>
                    <option value="تجارة جملة وتوزيع">تجارة جملة وتوزيع</option>
                    <option value="نشاط تجاري آخر">نشاط تجاري آخر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#2A7A62]" />
                    <span>المدينة / المحافظة</span>
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="مثال: القاهرة، الإسكندرية..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7CCFB0] transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-[#2A7A62]" />
                  <span>ملاحظات أو رابط صفحة فيسبوك/إنستغرام الحالية (اختياري)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="هل لديك صفحة تبيع عليها حالياً؟ كم صنف تقريباً تود عرضه؟"
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7CCFB0] resize-none transition-all"
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-full text-xs sm:text-sm font-black text-[#0E3A2E] transition-all flex items-center justify-center gap-2 active:scale-98 shadow-md"
                  style={{
                    backgroundImage: 'var(--gloss-jade)',
                    boxShadow: 'var(--lift-jade)',
                  }}
                >
                  {loading ? (
                    <span>جاري الإرسال...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>إرسال طلب الاستشارة وتصميم المتجر</span>
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 font-medium mt-2">
                  <span>🔒 بياناتك محمية تماماً</span>
                  <span>⚡ تواصل فوري خلال ساعات العمل</span>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
