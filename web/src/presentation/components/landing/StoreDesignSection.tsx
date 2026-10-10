import React from 'react';
import {
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Store,
  CreditCard,
  MessageCircle,
  Repeat,
  Printer,
} from 'lucide-react';

interface StoreDesignSectionProps {
  onOpenInquiryModal: () => void;
  onWhatsApp: (text: string) => void;
}

export const StoreDesignSection: React.FC<StoreDesignSectionProps> = ({
  onOpenInquiryModal,
  onWhatsApp,
}) => {
  return (
    <section id="ecommerce-store" className="relative z-20 py-24 overflow-hidden">
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[50vw] max-w-[900px] max-h-[700px] rounded-full blur-[140px] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(124,207,176,0.35),transparent_70%)]" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0E3A2E] bg-[#B2E7D2] px-4 py-1.5 rounded-full shadow-xs mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>خدمة تصميم وبرمجة المتاجر الإلكترونية</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-[#232D3C] tracking-tight leading-tight">
            تريد البيع أونلاين؟ نبني لك متجرك الإلكتروني بالكامل ونربطه بمنظومتك
          </h2>

          <p className="text-sm sm:text-base text-slate-600 mt-4 leading-relaxed font-normal">
            حل متكامل 360 درجة لتوسيع تجارتك: متجر رقمي عصري بهوية علامتك التجارية، يربط كاشير محلك وفروعك ومخازنك وبوابات الدفع وشركات الشحن — <b className="text-slate-800">بدون عمولة على مبيعاتك وبدون أي وجع رأس تقني</b>.
          </p>

          {/* Standalone Reassurance Badge */}
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-white/80 border border-slate-200/80 px-4 py-2 rounded-2xl shadow-xs">
            <span className="text-[#2A7A62]">🏪 لديك محل ملابس أو معرض فعلي؟</span>
            <span className="text-slate-500 font-normal">نظام كاشير ومخازن إنجاز برو يعمل بشكل مستقل تماماً في محلك، وميزة المتجر الإلكتروني هي توسع اختياري متى أردت.</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 📱💻 DUAL-DEVICE LIVE PREVIEW MOCKUP (المتجر الإلكتروني + كاشير إنجاز برو) */}
        {/* ========================================================================= */}
        <div
          className="mt-14 rounded-[36px] p-6 sm:p-10 border border-white/90 relative"
          style={{
            background: 'linear-gradient(160deg, #FAFCFF, var(--plate) 48%, var(--plate-2))',
            boxShadow: 'var(--clay)',
          }}
        >
          {/* Top Stage Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-6 border-b border-slate-200/70">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-slate-800">
                مزامنة حية ثنائية الاتجاه: متجرك أونلاين ⟷ نظام الكاشير والمخزن
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
              <span className="bg-white/80 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                ⚡ سحب الطلبات تلقائياً
              </span>
              <span className="bg-white/80 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                📦 جرد مخزون لحظي
              </span>
              <span className="bg-white/80 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                🧾 طباعة حرارية فورية
              </span>
            </div>
          </div>

          {/* Dual Screen Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-8">
            {/* Screen 1: The Online Store (Mobile Storefront) - 5 Cols */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="text-xs font-black text-slate-600 mb-2.5 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#2A7A62]" />
                <span>تجربة العميل على متجرك (واجهة الموبايل)</span>
              </div>

              {/* Phone Mockup Frame */}
              <div
                className="w-full max-w-[320px] rounded-[38px] p-3 border-4 border-slate-800/80 bg-slate-900 shadow-2xl relative"
                style={{ boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.4)' }}
              >
                {/* Speaker Notch */}
                <div className="w-24 h-4 bg-slate-800 rounded-b-xl mx-auto mb-2 flex items-center justify-center">
                  <div className="w-8 h-1 bg-slate-700 rounded-full" />
                </div>

                {/* Inner Screen */}
                <div className="rounded-[28px] bg-white p-3.5 space-y-3 text-right">
                  {/* Store Mini Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-lg bg-[#2A7A62] text-white flex items-center justify-center font-black text-[10px]">
                        E
                      </div>
                      <span className="font-black text-xs text-slate-800">براند ستور</span>
                    </div>
                    <div className="relative">
                      <ShoppingBag className="w-4 h-4 text-slate-700" />
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-600 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                        1
                      </span>
                    </div>
                  </div>

                  {/* Product Card */}
                  <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 space-y-2">
                    <div className="h-28 rounded-xl bg-gradient-to-tr from-emerald-100 via-teal-50 to-cyan-100 flex items-center justify-center relative overflow-hidden">
                      <span className="text-3xl">👟</span>
                      <span className="absolute top-2 right-2 text-[9px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full">
                        خصم 20%
                      </span>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-black text-xs text-slate-900">سنيكرز كاجوال مريح</div>
                        <div className="text-[10px] text-slate-400 font-medium">كود: SNK-809 | مقاس 42</div>
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-black text-[#2A7A62] font-mono">680 ج.م</div>
                        <div className="text-[9px] text-slate-400 line-through font-mono">850 ج.م</div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Quick Checkout Box */}
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900">
                      <span>إتمام الشراء السريع:</span>
                      <span className="text-emerald-700 font-mono">0109988****</span>
                    </div>

                    {/* Payment Badges */}
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 bg-white rounded text-[8px] font-bold text-slate-600 border border-slate-200">
                        💳 فيزا وماستركارد
                      </span>
                      <span className="px-1.5 py-0.5 bg-white rounded text-[8px] font-bold text-purple-700 border border-purple-200">
                        ⚡ إنستاباي
                      </span>
                      <span className="px-1.5 py-0.5 bg-white rounded text-[8px] font-bold text-rose-700 border border-rose-200">
                        📱 فودافون كاش
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={onOpenInquiryModal}
                      className="w-full py-1.5 bg-[#2A7A62] text-white rounded-xl font-black text-[11px] shadow-xs hover:bg-[#1f5c4a] transition-colors"
                    >
                      تأكيد الطلب الآن 🛍️
                    </button>
                  </div>

                  {/* Toast notification */}
                  <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900 text-white text-[9px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>تم تأكيد طلبك #8942 بنجاح وجاري التجهيز!</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Central Conduit / Sync Indicator - 2 Cols */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center gap-3 text-center my-4 lg:my-0">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-[#0E3A2E] animate-pulse"
                style={{
                  backgroundImage: 'var(--gloss-jade)',
                  boxShadow: 'var(--lift-jade)',
                }}
              >
                <Repeat className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-black text-[#232D3C] block">ربط فوري 100%</span>
                <span className="text-[10px] text-slate-500 leading-tight block">
                  بدون كتابة يدوية أو انتظار، الطلب يظهر في الكاشير في أقل من ثانية
                </span>
              </div>

              <div className="hidden lg:flex flex-col gap-1 text-[10px] font-mono text-emerald-800 font-bold bg-[#B2E7D2]/60 px-3 py-1 rounded-full">
                <span>Webhook API ⚡</span>
              </div>
            </div>

            {/* Screen 2: The Engaz Pro Cashier & Inventory Sync - 5 Cols */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="text-xs font-black text-slate-600 mb-2.5 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-blue-600" />
                <span>شاشة كاشير ومخازن إنجاز برو في محلك</span>
              </div>

              {/* POS Monitor Frame */}
              <div
                className="w-full max-w-[370px] rounded-[32px] p-4 border border-slate-200 bg-white shadow-xl space-y-3.5 text-right"
              >
                {/* POS Header Bar */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-black text-slate-900">نقطة بيع الفرع الرئيسي</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                    أوردر متجر وارد 🔔
                  </span>
                </div>

                {/* Live Order Card */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>أوردر أونلاين: #OR-8942</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          مدفوع إلكترونياً
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        العميل: كريم السعيد (0109988****) - المعادي
                      </div>
                    </div>
                  </div>

                  {/* Stock Update Status */}
                  <div className="p-2 rounded-xl bg-white border border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-bold">صنف: سنيكرز كاجوال (42)</span>
                    <span className="font-mono text-emerald-700 font-black">
                      المخزون: 19 قطعة (-1)
                    </span>
                  </div>
                </div>

                {/* Simulated Auto-Printed Thermal Slip */}
                <div
                  className="bg-amber-50/60 border border-dashed border-amber-300 rounded-2xl p-3 space-y-1.5 text-[10px] font-mono"
                >
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span className="flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5 text-amber-700" />
                      <span>إيصال التجهيز والشحن الحراري:</span>
                    </span>
                    <span className="text-[9px] text-amber-700">طابعة 80mm</span>
                  </div>
                  <div className="text-slate-700 border-t border-amber-200 pt-1 leading-relaxed">
                    <div>بوليصة الشحن: <b className="text-slate-900">SHP-2026-8942</b></div>
                    <div>شركة الشحن: تم حجز موعد استلام المندوب ✅</div>
                    <div>الإجمالي المسدد: <b className="text-[#0E3A2E]">680 ج.م</b> (شامل التوصيل)</div>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={onOpenInquiryModal}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <span>جاهز للشحن والتسليم للمندوب</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 💎 4 CORE ADVANTAGES OF OUR E-COMMERCE STORE SERVICE                       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 text-right">
          {/* Card 1 */}
          <div
            className="rounded-3xl p-6 relative border border-white/80 transition-all hover:-translate-y-1"
            style={{
              background: 'var(--plate)',
              boxShadow: 'var(--clay)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#0E3A2E] mb-4"
              style={{
                backgroundImage: 'var(--gloss-jade)',
                boxShadow: 'var(--lip-jade)',
              }}
            >
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-[#232D3C]">
              تصميم بهوية براندك وتجربة شراء بلمسة
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed font-normal">
              واجهة متجر عصرية فائقة السرعة ومتجاوبة تماماً مع شاشات الموبايل؛ مصممة بعناية لتحقيق أعلى معدل تحويل وإتمام طلبات بدون تعقيد.
            </p>
          </div>

          {/* Card 2 */}
          <div
            className="rounded-3xl p-6 relative border border-white/80 transition-all hover:-translate-y-1"
            style={{
              background: 'var(--plate)',
              boxShadow: 'var(--clay)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-blue-900 mb-4"
              style={{
                background: 'linear-gradient(180deg, #D4E6FA 0%, #B7D4F5 100%)',
                boxShadow: 'var(--lip)',
              }}
            >
              <Repeat className="w-6 h-6 text-blue-700" />
            </div>
            <h3 className="text-base font-black text-[#232D3C]">
              ربط تلقائي 100% مع الكاشير والمخزن
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed font-normal">
              وداعاً لإدخال البضائع مرتين؛ الصنف المضاف في المحل يُعرض فوراً في المتجر، وأي مبيعة أونلاين تخصم رصيدها من مخزن المحل أوتوماتيكياً.
            </p>
          </div>

          {/* Card 3 */}
          <div
            className="rounded-3xl p-6 relative border border-white/80 transition-all hover:-translate-y-1"
            style={{
              background: 'var(--plate)',
              boxShadow: 'var(--clay)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-amber-900 mb-4"
              style={{
                background: 'linear-gradient(180deg, #FDE6B8 0%, #F0C980 100%)',
                boxShadow: 'var(--lip)',
              }}
            >
              <CreditCard className="w-6 h-6 text-amber-800" />
            </div>
            <h3 className="text-base font-black text-[#232D3C]">
              بوابات دفع إلكتروني وربط شركات الشحن
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed font-normal">
              تفعيل وسائل الدفع: فيزا، ماستركارد، فودافون كاش، إنستاباي، مع ربط بوالص الشحن التلقائية مع شركات التوصيل وتتبع خطوط السير.
            </p>
          </div>

          {/* Card 4 */}
          <div
            className="rounded-3xl p-6 relative border border-white/80 transition-all hover:-translate-y-1"
            style={{
              background: 'var(--plate)',
              boxShadow: 'var(--clay)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-purple-900 mb-4"
              style={{
                background: 'linear-gradient(180deg, #E9D5FF 0%, #D8B4FE 100%)',
                boxShadow: 'var(--lip)',
              }}
            >
              <ShieldCheck className="w-6 h-6 text-purple-800" />
            </div>
            <h3 className="text-base font-black text-[#232D3C]">
              صفر عمولة على المبيعات والملكية لك
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed font-normal">
              لا نقتطع أي نسبة مئوية من أرباحك اليومية أو الشهرية؛ متجرك وقاعدة بيانات عملائك وأرباحك ملك لك بالكامل بنسبة 100%.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 🚀 CALL TO ACTION BAR                                                     */}
        {/* ========================================================================= */}
        <div
          className="mt-12 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-white/90"
          style={{
            background: 'linear-gradient(135deg, rgba(42, 122, 98, 0.08) 0%, rgba(183, 212, 245, 0.15) 100%)',
            boxShadow: 'var(--clay)',
          }}
        >
          <div className="text-right">
            <h4 className="text-xl sm:text-2xl font-black text-[#232D3C]">
              جاهز لإطلاق مبيعاتك أونلاين ومضاعفة أرباحك؟
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium">
              تواصل معنا الآن، وسيقوم فريقنا بدراسة نشاطك وتجهيز متجرك وربطه بمنظومة إنجاز برو خلال أيام قليلة.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={onOpenInquiryModal}
              className="w-full sm:w-auto px-6 py-3.5 rounded-full text-xs sm:text-sm font-black text-[#0E3A2E] transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md"
              style={{
                backgroundImage: 'var(--gloss-jade)',
                boxShadow: 'var(--lift-jade)',
              }}
            >
              <Sparkles className="w-4 h-4" />
              <span>اطلب تصميم متجرك المتكامل الآن</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onWhatsApp(
                  'مرحباً، أود الاستفسار عن خدمة تصميم وتطوير متجر إلكتروني متكامل وربطه مع كاشير ومخازن إنجاز برو.'
                )
              }
              className="w-full sm:w-auto px-5 py-3.5 rounded-full text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 transition-all flex items-center justify-center gap-2 active:scale-95"
              style={{
                background: 'var(--gloss)',
                boxShadow: 'var(--lift), var(--lip)',
              }}
            >
              <MessageCircle className="w-4 h-4 text-[#2A7A62]" />
              <span>استفسر عبر واتساب فوراً</span>
            </button>
          </div>
        </div>

        {/* Assurance Pills */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-bold text-slate-500 mt-6">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            استشارة مجانية ودراسة لنشاطك التجاري
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            تسليم وتدريب كامل في 7 أيام عمل
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            دعم فني وضمان تشغيلي شامل
          </span>
        </div>
      </div>
    </section>
  );
};
