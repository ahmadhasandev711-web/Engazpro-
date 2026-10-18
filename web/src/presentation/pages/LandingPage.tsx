import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  CheckCircle2,
  ArrowLeft,
  Zap,
  MessageCircle,
  Store,
  Truck,
  Building2,
  ShoppingBag,
  ChevronDown,
  Layers,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { StoreDesignSection } from '../components/landing/StoreDesignSection';
import { StoreInquiryModal } from '../components/landing/StoreInquiryModal';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  // State for store inquiry modal
  const [isStoreInquiryModalOpen, setIsStoreInquiryModalOpen] = useState<boolean>(false);

  // State for interactive Celadon Stave Accordion (6 Pillars)
  const [activeStave, setActiveStave] = useState<number>(0);

  // State for interactive Pricing Billing Cycle ('monthly' | 'yearly')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  // State for customer stories carousel
  const [activeStory, setActiveStory] = useState<number>(0);

  // State for FAQ accordion
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // State for mobile drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const handleWhatsApp = (text: string) => {
    const message = encodeURIComponent(text);
    window.open(`https://wa.me/201125030642?text=${message}`, '_blank');
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Six Core Stave Pillars data (Inspired by Celadon Stave Panels)
  const staves = [
    {
      id: 0,
      title: 'نقطة بيع سريعة (POS) للمحلات والمعارض',
      shortTitle: 'كاشير POS ذكي',
      badge: 'السرعة والسهولة',
      color: 'var(--jade)',
      icon: Store,
      tag: 't-jade',
      desc: 'كاشير لمسي فائق السرعة يدعم قارئ الباركود، الفواتير الحرارية، البيع المجزأ (نقدي + شبكة)، وتعليق الفواتير المؤقتة مع العمل دون انقطاع حتى لو انقطع الإنترنت.',
      proofTitle: 'إصدار الفاتورة بالكامل في أقل من ثانيتين مع طباعة فورية على أي طابعة بلوتوث أو USB.',
      features: ['واجهة لمسية متطابقة مع أجهزة الكاشير والموبايل', 'قارئ باركود فوري واختصارات سريعة بلوحة المفاتيح', 'طباعة حرارية ذكية بمقاسات 80mm و 57mm'],
    },
    {
      id: 1,
      title: 'فصل الخزن والعهد والرقابة على الورديات',
      shortTitle: 'الخزن والورديات',
      badge: 'صفر عجز مالي',
      color: 'var(--sky)',
      icon: Wallet,
      tag: 't-sky',
      desc: 'افصل خزينة المحل الرئيسية عن أدراج الكاشير وعهد المناديب وحسابات البنوك والمحافظ الإلكترونية (فودافون كاش وإنستاباي). تسليم وتسوية الوردية بمطابقة نقدية صارمة تمنع التلاعب.',
      proofTitle: 'منع تام لتسريب الأرباح ومطابقة دقيقة لفلوس الدرج قبل إقفال شيفت الكاشير.',
      features: ['خزينة رئيسية + خزن فروع + عهد مناديب منفصلة', 'تسوية إجبارية لنهاية الوردية ومطابقة العجز والفائض', 'دعم الدفع المجزأ وحسابات البنوك والمحافظ'],
    },
    {
      id: 2,
      title: 'إدارة الفروع والمخازن المتعددة وأذون التحويل',
      shortTitle: 'الفروع والمخازن',
      badge: 'مركزية متكاملة',
      color: 'var(--coral)',
      icon: Building2,
      tag: 't-coral',
      desc: 'راقب أرصدة بضائعك عبر كافة الفروع والمستودعات المركزية في شاشة واحدة. انقل البضائع بأذون تحويل رسمية (Stock Transfers) تتطلب تأكيد الاستلام الميداني لتفادي ضياع الأصناف.',
      proofTitle: 'تتبع حركة البضاعة المنقولة لحظة بلحظة بين المعارض وسيارات المناديب والمستودع.',
      features: ['جرد حي متزامن لأكثر من 50 فرع ومخزن', 'أذون تحويل بضاعة ذكية مع مسارات تتبع الاستلام', 'تنبيهات نواقص المخزون والوصول للحد الأدنى'],
    },
    {
      id: 3,
      title: 'تطبيق المناديب والمبيعات والتحصيل الميداني',
      shortTitle: 'تطبيق المناديب',
      badge: 'مبيعات ميدانية',
      color: 'var(--jade)',
      icon: Truck,
      tag: 't-jade',
      desc: 'حوّل هاتف مندوبك إلى نقطة بيع متنقلة تصدر فواتير بيع وسندات قبض حرارية بالبلوتوث، مع متابعة مديونيات العملاء، وسداد الفواتير الآجلة، وتقفيل العهدة نهاية اليوم.',
      proofTitle: 'توفير 4 ساعات يومياً كان يقضيها المندوب في تفريغ الفواتير الورقية والمطابقة اليدوية.',
      features: ['فواتير متنقلة فورية مع طباعة إيصالات بلوتوث محمولة', 'كشف حساب فوري للعميل في الميدان بلمسة واحدة', 'توريد العهد النقدية للفرع الرئيسي بنقرة زر'],
    },
    {
      id: 4,
      title: 'الربط المباشر مع متجر WooCommerce',
      shortTitle: 'ربط ووكومرس',
      badge: 'تزامن لحظي',
      color: 'var(--sky)',
      icon: ShoppingBag,
      tag: 't-sky',
      desc: 'سحب تلقائي للطلبات الواردة من متجرك الإلكتروني، وتوليد فواتير فورية، مع مزامنة لحظية ثنائية الاتجاه للمخزون وأسعار البيع والتخفيضات لمنع بيع أصناف نفدت من المعرض.',
      proofTitle: 'مزامنة كاملة عبر الـ Webhook بدون الحاجة لأي إدخال يدوي أو تكرار بيانات.',
      features: ['سحب فوري لأوردرات المتجر الإلكتروني لحظة تأكيدها', 'تحديث كميات المخزون أوتوماتيكياً في المعرض والمتجر', 'مزامنة الخصومات والأسعار الترويجية بين القنوات'],
    },
    {
      id: 5,
      title: 'تقارير الأرباح الحقيقية وكشوف الحسابات',
      shortTitle: 'الأرباح الحقيقية',
      badge: 'دقة محاسبية',
      color: 'var(--coral)',
      icon: TrendingUp,
      tag: 't-coral',
      desc: 'اعرف أرباحك الصافية الحقيقية بعد خصم تكلفة البضاعة المباعة (COGS) والمصروفات التشغيلية. مع كشوف حساب تفصيلية لعملاء الآجل والموردين ودفتر أستاذ زمني دقيق.',
      proofTitle: 'حسابات مطابقة لقواعد المعايير المحاسبية بدون أي ثغرات أو معادلات معقدة.',
      features: ['تقرير الأرباح والخسائر الصافي بنقرة زر واحدة', 'كشوف حساب تفصيلية لمديونيات العملاء والموردين', 'تصدير كامل لكافة التقارير والسجلات إلى Excel'],
    },
  ];

  // Customer stories data
  const stories = [
    {
      quote: 'قبل إنجاز برو، كنا ننهي الشهر بعجز غير مفهوم في الخزينة. ميزة فصل خزن الفروع عن عهد المناديب أغلقت كل أبواب الهدر وأنقذت أرباحنا.',
      author: 'م. حسام الدين شلبي',
      role: 'مالك سلسلة محلات أجهزة كهربائية وإلكترونيات — القاهرة',
      result: 'وفر 35,000 ج.م شهرياً من الهدر',
      tagColor: 'var(--jade)',
      initials: 'ح.ش',
    },
    {
      quote: 'الربط التلقائي مع متجرنا على WooCommerce حل أكبر كابوس واجهناه: بيع أصناف نفدت من المعرض. الآن المخزون والأسعار يتطابقان لحظياً وبلا خطأ واحد.',
      author: 'أحمد فاروق',
      role: 'مؤسس علامة تجارية لملابس الشباب — الإسكندرية',
      result: 'صفر أوردرات ملغاة بسبب المخزون',
      tagColor: 'var(--sky)',
      initials: 'أ.ف',
    },
    {
      quote: 'مناديب المبيعات أصبحوا يطبعون الفاتورة وسند القبض بالبلوتوث أمام العميل مباشرة. الكفاءة تضاعفت والتحصيلات انضبطت بنسبة 100%.',
      author: 'خالد عبد الرحمن',
      role: 'مدير عمليات شركة توزيع مواد غذائية — المنصورة',
      result: 'توفير 4 ساعات يومياً لكل مندوب',
      tagColor: 'var(--coral)',
      initials: 'خ.ع',
    },
    {
      quote: 'السرعة في الكاشير لا تُصدق! نمرر الباركود وتخرج الفاتورة في ثانية. النظام خفيف جداً ويعمل على أي تابلت وموبايل بدون شراء أجهزة باهظة.',
      author: 'سارة المهدي',
      role: 'مديرة معرض أدوات تجميل وعطور — الجيزة',
      result: 'خدمة 180 عميل في ساعات الذروة بسلاسة',
      tagColor: 'var(--jade)',
      initials: 'س.م',
    },
  ];

  // Integrations data
  const integrations = [
    { name: 'WooCommerce', dot: 'var(--jade)', desc: 'مزامنة المتجر والطلبات' },
    { name: 'طابعات الفواتير ESC/POS', dot: 'var(--sky)', desc: 'بلوتوث و USB و شبكة' },
    { name: 'قارئات الباركود والـ QR', dot: 'var(--coral)', desc: 'دعم كل الأجهزة اللاسلكية' },
    { name: 'فودافون كاش والمحافظ', dot: '#F0C980', desc: 'حسابات خزن ومحافظ مستقلة' },
    { name: 'إنستاباي InstaPay', dot: 'var(--jade)', desc: 'تسوية التحويلات اللحظية' },
    { name: 'ميكروسوفت Excel', dot: 'var(--sky)', desc: 'استيراد وتصدير كامل' },
    { name: 'تطبيق WhatsApp', dot: 'var(--jade)', desc: 'إرسال الفواتير والمتابعة' },
    { name: 'أجهزة أندرويد و iOS', dot: 'var(--coral)', desc: 'تطبيق الويب التقدمي PWA' },
    { name: 'شاشات وكاشيرات اللمس', dot: '#F0C980', desc: 'متوافق مع كل مقاسات POS' },
    { name: 'موازين الباركود الإلكترونية', dot: 'var(--sky)', desc: 'قراءة أوزان وأسعار الباركود' },
  ];

  // Pricing calculations
  const isYearly = billingCycle === 'yearly';

  return (
    <div
      className="min-h-screen text-[#232D3C] font-sans selection:bg-[#7CCFB0] selection:text-[#0E3A2E] relative overflow-x-hidden bg-[#E8EDF7]"
      dir="rtl"
    >
      {/* Celadon Soft Ambient Blooms (Subtle Colorful Canvas Lighting) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-24 right-[10%] w-[55vw] h-[45vw] max-w-[700px] max-h-[600px] rounded-full blur-[110px] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(183,212,245,0.7),transparent_65%)]" />
        <div className="absolute top-[20%] -left-20 w-[50vw] h-[45vw] max-w-[650px] max-h-[600px] rounded-full blur-[110px] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(124,207,176,0.5),transparent_65%)]" />
        <div className="absolute top-[60%] right-[12%] w-[60vw] h-[50vw] max-w-[800px] max-h-[700px] rounded-full blur-[130px] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(232,115,92,0.22),transparent_70%)]" />
      </div>

      {/* Floating Celadon Capsule Header */}
      <div className="relative z-30 max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        <header
          className="rounded-full px-5 sm:px-8 py-3.5 flex items-center justify-between transition-all"
          style={{
            background: 'linear-gradient(180deg, rgba(254, 254, 255, .95) 0%, rgba(244, 247, 253, .92) 46%, rgba(232, 238, 250, .9) 46.01%, rgba(222, 231, 246, .9) 100%)',
            backdropFilter: 'blur(16px)',
            boxShadow: 'var(--lift), var(--lip)',
          }}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <span className="font-black text-2xl tracking-tighter text-slate-900 font-sans flex items-center">
              Engaz<span className="text-[#2A7A62]">.</span>
              <span className="mr-1.5 text-[10px] font-black bg-[#B2E7D2] text-[#0E3A2E] px-2 py-0.5 rounded-full">
                PRO
              </span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-slate-600">
            <a href="#features" className="px-3.5 py-1.5 rounded-full hover:text-slate-900 hover:bg-[#DCE4F3]/60 transition-all">
              المميزات
            </a>
            <a href="#staves" className="px-3.5 py-1.5 rounded-full hover:text-slate-900 hover:bg-[#DCE4F3]/60 transition-all">
              أركان المنظومة
            </a>
            <a href="#how" className="px-3.5 py-1.5 rounded-full hover:text-slate-900 hover:bg-[#DCE4F3]/60 transition-all">
              كيف يعمل؟
            </a>
            <a href="#integrations" className="px-3.5 py-1.5 rounded-full hover:text-slate-900 hover:bg-[#DCE4F3]/60 transition-all">
              الربط والأنظمة
            </a>
            <a href="#ecommerce-store" className="px-3 py-1.5 rounded-full text-[#0E3A2E] bg-[#B2E7D2]/80 hover:bg-[#B2E7D2] font-black transition-all flex items-center gap-1 shadow-2xs">
              <span>تصميم المتاجر</span>
              <span className="text-xs">🛍️</span>
            </a>
            <a href="#pricing" className="px-3.5 py-1.5 rounded-full hover:text-slate-900 hover:bg-[#DCE4F3]/60 transition-all">
              الأسعار
            </a>
            <a href="#faq" className="px-3.5 py-1.5 rounded-full hover:text-slate-900 hover:bg-[#DCE4F3]/60 transition-all">
              الأسئلة
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-black text-[#0E3A2E] transition-all flex items-center gap-1.5 active:scale-95"
                style={{
                  backgroundImage: 'var(--gloss-jade)',
                  boxShadow: 'var(--lift-jade), var(--lip-jade)',
                }}
              >
                <span>لوحة التحكم</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 px-3 py-2 transition-colors whitespace-nowrap"
                >
                  دخول
                </Link>
                <Link
                  to="/register"
                  className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-black text-[#0E3A2E] transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  style={{
                    backgroundImage: 'var(--gloss-jade)',
                    boxShadow: 'var(--lift-jade), var(--lip-jade)',
                  }}
                >
                  <span>ابدأ مجاناً</span>
                  <Zap className="w-3.5 h-3.5 fill-[#0E3A2E]" />
                </Link>
              </>
            )}

            {/* Mobile menu toggle button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-slate-700 bg-white/70 shadow-xs"
              aria-label="القائمة"
            >
              <div className="w-5 h-4 flex flex-col justify-between items-center">
                <span className="w-full h-0.5 bg-slate-800 rounded-full" />
                <span className="w-full h-0.5 bg-slate-800 rounded-full" />
                <span className="w-full h-0.5 bg-slate-800 rounded-full" />
              </div>
            </button>
          </div>
        </header>

        {/* Mobile Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden mt-2 p-4 rounded-3xl space-y-2 border border-white/80 animate-fade-in shadow-xl"
            style={{
              background: 'linear-gradient(160deg, #FBFDFF, var(--plate) 48%, var(--plate-2))',
              boxShadow: 'var(--clay)',
            }}
          >
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-[#DCE4F3]"
            >
              المميزات
            </a>
            <a
              href="#staves"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-[#DCE4F3]"
            >
              أركان المنظومة
            </a>
            <a
              href="#how"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-[#DCE4F3]"
            >
              كيف يعمل؟
            </a>
            <a
              href="#integrations"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-[#DCE4F3]"
            >
              الربط والأنظمة
            </a>
            <a
              href="#ecommerce-store"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-2xl text-sm font-black text-[#0E3A2E] bg-[#B2E7D2]/60 hover:bg-[#B2E7D2]"
            >
              تصميم المتاجر 🛍️
            </a>
            <a
              href="#pricing"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-[#DCE4F3]"
            >
              الأسعار
            </a>
            <a
              href="#faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-[#DCE4F3]"
            >
              الأسئلة الشائعة
            </a>
            <div className="pt-2 border-t border-slate-200/60">
              <Link
                to="/register"
                className="block text-center py-3 rounded-2xl text-sm font-black text-[#0E3A2E]"
                style={{
                  backgroundImage: 'var(--gloss-jade)',
                  boxShadow: 'var(--lift-jade)',
                }}
              >
                إنشاء حساب مجاني (14 يوم اً)
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 🌟 HERO SECTION WITH CELADON 3D STAGE & FLOATING SLABS                    */}
      {/* ========================================================================= */}
      <section className="relative z-20 pt-10 pb-16 md:pt-16 md:pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Celadon Announcement Pill */}
          <div
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-semibold text-slate-600 mb-6 shadow-xs"
            style={{
              background: 'var(--gloss)',
              boxShadow: 'var(--lift), var(--lip)',
            }}
          >
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-[#0E3A2E]"
              style={{
                background: 'var(--gloss-jade)',
                boxShadow: 'var(--lip-jade)',
              }}
            >
              جديد v2.5
            </span>
            <span>الربط التلقائي مع ووكومرس • فصل الخزن والورديات • فواتير المناديب</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#232D3C] tracking-tight leading-[1.2] max-w-4xl mx-auto">
            أدِر تجارتك، فروعك، ومخازنك
            <br />
            <span className="text-[#2A7A62]">باحترافية كاملة ودون تعقيد</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mt-5 leading-relaxed font-normal">
            مش مجرد كاشير تقليدي! <strong>إنجاز برو</strong> يمنحك نقطة بيع POS فائقة السرعة، رقابة صارمة على الخزائن وتسليم الورديات لمنع أي عجز أو تلاعب، مع تطبيق المناديب وربط متجرك الإلكتروني لحظياً.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-full text-base font-black text-[#0E3A2E] transition-all flex items-center justify-center gap-3 group active:scale-95 shadow-md"
              style={{
                backgroundImage: 'var(--gloss-jade)',
                boxShadow: 'var(--lift-jade-hi), var(--lip-jade)',
              }}
            >
              <span>ابدأ تجربتك المجانية (14 يوم اً كاملة)</span>
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </Link>

            <button
              type="button"
              onClick={() => handleWhatsApp('مرحباً، أود معرفة تفاصيل الاشتراك في منظومة إنجاز برو')}
              className="w-full sm:w-auto px-7 py-4 rounded-full text-base font-bold text-slate-800 transition-all flex items-center justify-center gap-2.5 active:scale-95 border border-white/60 shadow-sm"
              style={{
                background: 'var(--gloss)',
                boxShadow: 'var(--lift), var(--lip)',
              }}
            >
              <MessageCircle className="w-5 h-5 text-[#2A7A62]" />
              <span>استشر فريق المبيعات عبر واتساب</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 font-medium mt-3.5">
            تجربة مجانية لمدة 14 يوم اً بكامل الصلاحيات. بدون بطاقة بنكية. إعداد المتجر في دقيقتين.
          </p>

          {/* ------------------------------------------------------------- */}
          {/* THE CELADON 3D STAGE: Central Core with 4 Floating Clay Slabs */}
          {/* ------------------------------------------------------------- */}
          <div className="mt-14 relative max-w-4xl mx-auto">
            {/* Desktop Orbiting Clay Slabs */}
            <div className="hidden lg:block">
              {/* Slab 1: Top Right (WooCommerce Sync) */}
              <div
                className="absolute -top-6 -right-6 z-20 w-64 p-4 rounded-3xl text-right transition-transform hover:-translate-y-1 text-xs"
                style={{
                  background: 'linear-gradient(160deg, #FBFDFF, var(--plate) 48%, var(--plate-2))',
                  boxShadow: 'var(--clay)',
                }}
              >
                <div className="flex items-center gap-2 font-bold text-[#232D3C]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'var(--sky)', boxShadow: '0 2px 4px rgba(35,45,60,0.2)' }}
                  />
                  <span>طلب ووكومرس أونلاين</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5 font-medium leading-relaxed">
                  تم سحب طلب شحن جديد #5120 ومزامنة رصيد المخزن الرئيسي فوراً ⚡
                </p>
              </div>

              {/* Slab 2: Top Left (Shift Handover) */}
              <div
                className="absolute -top-4 -left-6 z-20 w-64 p-4 rounded-3xl text-right transition-transform hover:-translate-y-1 text-xs"
                style={{
                  background: 'linear-gradient(160deg, #FBFDFF, var(--plate) 48%, var(--plate-2))',
                  boxShadow: 'var(--clay)',
                }}
              >
                <div className="flex items-center gap-2 font-bold text-[#232D3C]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'var(--coral)', boxShadow: '0 2px 4px rgba(35,45,60,0.2)' }}
                  />
                  <span>تسوية وردية الكاشير</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5 font-medium leading-relaxed">
                  تسليم 14,350 ج.م نقدية مطابقة لفلوس الدرج بالقرش وبدون عجز ✅
                </p>
              </div>

              {/* Slab 3: Bottom Right (Mandob Collections) */}
              <div
                className="absolute -bottom-6 -right-6 z-20 w-64 p-4 rounded-3xl text-right transition-transform hover:-translate-y-1 text-xs"
                style={{
                  background: 'linear-gradient(160deg, #FBFDFF, var(--plate) 48%, var(--plate-2))',
                  boxShadow: 'var(--clay)',
                }}
              >
                <div className="flex items-center gap-2 font-bold text-[#232D3C]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'var(--jade)', boxShadow: '0 2px 4px rgba(35,45,60,0.2)' }}
                  />
                  <span>تحصيل المندوب الميداني</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5 font-medium leading-relaxed">
                  المندوب محمود قام بتحصيل 8,500 ج.م كاش وأصدر فاتورة حرارية 📄
                </p>
              </div>

              {/* Slab 4: Bottom Left (Low Stock Alert) */}
              <div
                className="absolute -bottom-6 -left-6 z-20 w-64 p-4 rounded-3xl text-right transition-transform hover:-translate-y-1 text-xs"
                style={{
                  background: 'linear-gradient(160deg, #FBFDFF, var(--plate) 48%, var(--plate-2))',
                  boxShadow: 'var(--clay)',
                }}
              >
                <div className="flex items-center gap-2 font-bold text-[#232D3C]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: '#F0C980', boxShadow: '0 2px 4px rgba(35,45,60,0.2)' }}
                  />
                  <span>إنذار نواقص المخزن</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5 font-medium leading-relaxed">
                  تنبيه ذكي: الصنف (شاحن سريع 35W) وصل لحد الطلب — متبقي 3 قطع ⚠️
                </p>
              </div>
            </div>

            {/* Central Core Plate (The Engine of Engaz Pro) */}
            <div
              className="rounded-[36px] p-6 sm:p-9 text-right relative z-10 border border-white/90"
              style={{
                background: 'linear-gradient(158deg, #FCFEFF, #F1F6FD 46%, #E7EEFA)',
                boxShadow: '0 34px 54px -24px rgba(35, 45, 60, .38), 0 12px 22px -12px rgba(35, 45, 60, .2), inset 2px 3px 5px 0 rgba(255, 255, 255, .98), inset -4px -6px 12px 0 rgba(35, 45, 60, .11)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="mr-3 font-mono text-xs font-bold text-slate-500">
                    engaz-pro.app — الفرع الرئيسي (لوحة التحكم الحية)
                  </span>
                </div>
                <span className="text-[11px] font-black px-3 py-1 rounded-full text-[#0E3A2E] bg-[#B2E7D2] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2A7A62] animate-ping" />
                  الورديات نشطة • الخزن متطابقة
                </span>
              </div>

              {/* Core Content Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                {/* Metric 1 */}
                <div
                  className="p-4 rounded-2xl text-right"
                  style={{
                    background: 'var(--plate)',
                    boxShadow: 'var(--clay-sm)',
                  }}
                >
                  <span className="text-[11px] font-bold text-slate-500 block">مبيعات اليوم المحققة</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black font-mono text-[#232D3C]">38,450.00</span>
                    <span className="text-[10px] font-bold text-[#0E3A2E] bg-[#B2E7D2] px-2 py-0.5 rounded-full">
                      +28% اليوم
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">من 46 فاتورة مبيعات</span>
                </div>

                {/* Metric 2 */}
                <div
                  className="p-4 rounded-2xl text-right"
                  style={{
                    background: 'var(--plate)',
                    boxShadow: 'var(--clay-sm)',
                  }}
                >
                  <span className="text-[11px] font-bold text-slate-500 block">السيولة النقدية الحية</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black font-mono text-[#2A7A62]">52,180.00</span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      3 خزن موزعة
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">خزينة رئيسية + أدراج + بنك</span>
                </div>

                {/* Metric 3 */}
                <div
                  className="p-4 rounded-2xl text-right"
                  style={{
                    background: 'var(--plate)',
                    boxShadow: 'var(--clay-sm)',
                  }}
                >
                  <span className="text-[11px] font-bold text-slate-500 block">تزامن WooCommerce</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-amber-600 font-mono">متصل ⚡</span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Webhook نشط
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">آخر طلب مسحوب: منذ دقيقة</span>
                </div>
              </div>

              {/* Progress Meter Bar (Celadon Meter) */}
              <div className="mt-6 pt-5 border-t border-slate-200/70">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                  <span>معدل مطابقة الحسابات والورديات اليوم</span>
                  <span className="font-mono font-black text-[#2A7A62]">99.8% دقة متناهية</span>
                </div>
                <div
                  className="h-3 rounded-full overflow-hidden p-0.5"
                  style={{ background: 'var(--sunk)', boxShadow: 'var(--well)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: '99.8%',
                      background: 'linear-gradient(90deg, #9BDCC3, var(--jade))',
                      boxShadow: 'inset 0 -2px 3px rgba(20, 80, 62, .3), inset 0 1px 2px rgba(255, 255, 255, .7)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🏛️ TRUST STRIP (محل ثقة كبرى الأنشطة التجارية)                          */}
      {/* ========================================================================= */}
      <section className="relative z-10 py-10 border-y border-slate-200/50 bg-white/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
            المنظومة المفضلة لدى أكثر من 1,800 متجر ومؤسسة تجارية في مختلف القطاعات
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-slate-600 font-bold text-sm">
            <span className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#2A7A62]" /> محلات التجزئة والسوبرماركت
            </span>
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" /> معارض الملابس والمقاسات
            </span>
            <span className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" /> شركات التوزيع والمناديب
            </span>
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-purple-600" /> المتاجر الإلكترونية
            </span>
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" /> مستودعات الجملة وقطع الغيار
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🧩 THE 6 EXPANDABLE STAVE PANELS (أركان المنظومة الستة التفاعلية)          */}
      {/* ========================================================================= */}
      <section id="staves" className="relative z-20 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2A7A62] bg-[#B2E7D2]/60 px-3 py-1 rounded-full">
              أركان المنظومة المتكاملة
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#232D3C] mt-3">
              ستة أعمدة صلبة، منظومة واحدة متماسكة
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 font-normal">
              اضغط على أي ركن للاطلاع على تفاصيل الأداء وكيف يحل لك كل مشكلة في تجارتك
            </p>
          </div>

          {/* Desktop Interactive Celadon Staves Layout */}
          <div className="hidden md:flex gap-3 h-[490px] min-w-0">
            {staves.map((stave) => {
              const isOpen = activeStave === stave.id;
              const IconComp = stave.icon;

              return (
                <div
                  key={stave.id}
                  onClick={() => setActiveStave(stave.id)}
                  className={`relative rounded-[28px] overflow-hidden cursor-pointer transition-all duration-500 flex flex-col justify-between ${isOpen ? 'flex-1 cursor-default' : 'flex-[0_1_90px] hover:-translate-y-1'
                    }`}
                  style={{
                    background: isOpen
                      ? 'var(--gloss-plate)'
                      : 'linear-gradient(163deg, #E9EEF8, #DBE4F2)',
                    boxShadow: isOpen
                      ? 'var(--clay)'
                      : '0 18px 30px -18px rgba(35, 45, 60, .4), inset 2px 3px 4px 0 rgba(255, 255, 255, .8), inset -3px -5px 9px 0 rgba(35, 45, 60, .1)',
                  }}
                >
                  {/* Closed Spine View */}
                  {!isOpen && (
                    <div className="absolute inset-0 flex flex-col items-center justify-between py-7 px-2">
                      <div
                        className="w-4 h-4 rounded-full shadow-xs shrink-0"
                        style={{ background: stave.color }}
                      />
                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 tracking-wider">
                        {stave.shortTitle}
                      </span>
                      <IconComp className="w-5 h-5 text-slate-400" />
                    </div>
                  )}

                  {/* Open Body View */}
                  {isOpen && (
                    <div className="p-8 sm:p-10 h-full flex flex-col justify-between animate-fade-in text-right">
                      <div>
                        {/* Tile Icon */}
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                          style={{
                            background: stave.color,
                            boxShadow: '0 12px 18px -12px rgba(35, 45, 60, .55), inset 2px 2px 3px rgba(255, 255, 255, .7), inset -3px -4px 7px rgba(35, 45, 60, .16)',
                          }}
                        >
                          <IconComp className="w-7 h-7 text-[#0E3A2E]" />
                        </div>

                        <span className="text-xs font-black text-[#2A7A62] tracking-wider uppercase">
                          {stave.badge}
                        </span>
                        <h3 className="text-2xl font-black text-[#232D3C] mt-2 max-w-md">
                          {stave.title}
                        </h3>
                        <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-lg font-normal">
                          {stave.desc}
                        </p>

                        <div className="mt-5 space-y-2">
                          {stave.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                              <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Proof Capsule */}
                      <div
                        className="p-3.5 px-4 rounded-2xl text-xs font-bold text-slate-700 max-w-lg mt-6"
                        style={{
                          background: 'var(--sunk)',
                          boxShadow: 'var(--well)',
                        }}
                      >
                        💡 <strong>النتيجة المباشرة:</strong> {stave.proofTitle}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile Stacked Staves Accordion */}
          <div className="md:hidden space-y-3.5">
            {staves.map((stave) => {
              const isOpen = activeStave === stave.id;
              const IconComp = stave.icon;

              return (
                <div
                  key={stave.id}
                  onClick={() => setActiveStave(isOpen ? -1 : stave.id)}
                  className="rounded-3xl p-5 text-right transition-all border border-white/80"
                  style={{
                    background: isOpen ? 'var(--gloss-plate)' : 'var(--plate)',
                    boxShadow: isOpen ? 'var(--clay)' : 'var(--clay-sm)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: stave.color }}
                      >
                        <IconComp className="w-5 h-5 text-[#0E3A2E]" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-[#2A7A62] block">{stave.badge}</span>
                        <h4 className="text-sm font-black text-[#232D3C]">{stave.shortTitle}</h4>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-[#2A7A62]' : ''}`}
                    />
                  </div>

                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-slate-200/60 animate-fade-in space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed font-normal">{stave.desc}</p>
                      <div className="space-y-1.5 pt-1">
                        {stave.features.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2A7A62] shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                      <div
                        className="p-3 rounded-xl text-[11px] font-bold text-slate-700"
                        style={{ background: 'var(--sunk)', boxShadow: 'var(--well)' }}
                      >
                        💡 {stave.proofTitle}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🚀 THE 3-STEP PROCESS (كيف تبدأ مع إنجاز برو في 3 خطوات)                   */}
      {/* ========================================================================= */}
      <section id="how" className="relative z-20 py-16 bg-white/40 border-y border-slate-200/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2A7A62] bg-[#B2E7D2]/60 px-3 py-1 rounded-full">
            خريطة الانطلاق
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#232D3C] mt-3">
            ثلاث خطوات فقط، ثم يعمل النظام تلقائياً
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 text-right">
            {/* Step 1 */}
            <div
              className="rounded-3xl p-7 relative"
              style={{
                background: 'var(--plate)',
                boxShadow: 'var(--clay)',
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-[#0E3A2E] mb-5 font-mono"
                style={{
                  background: 'var(--gloss-jade)',
                  boxShadow: 'var(--lip-jade)',
                }}
              >
                1
              </div>
              <h3 className="text-lg font-black text-[#232D3C]">أنشئ حسابك في دقيقة</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed font-normal">
                أدخل اسم متجرك وفروعك وخزائنك. لا نطلب أي بطاقة بنكية أو إجراءات ورقية معقدة.
              </p>
            </div>

            {/* Step 2 */}
            <div
              className="rounded-3xl p-7 relative"
              style={{
                background: 'var(--plate)',
                boxShadow: 'var(--clay)',
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-blue-900 mb-5 font-mono"
                style={{
                  background: 'linear-gradient(180deg, #D4E6FA 0%, #B7D4F5 100%)',
                  boxShadow: 'var(--lip)',
                }}
              >
                2
              </div>
              <h3 className="text-lg font-black text-[#232D3C]">أضف أصنافك أو اربط متجرك</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed font-normal">
                استورد قائمة بضائعك من ملف Excel بنقرة واحدة، أو اربط متجر ووكومرس لسحب المنتجات تلقائياً.
              </p>
            </div>

            {/* Step 3 */}
            <div
              className="rounded-3xl p-7 relative"
              style={{
                background: 'var(--plate)',
                boxShadow: 'var(--clay)',
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-amber-900 mb-5 font-mono"
                style={{
                  background: 'linear-gradient(180deg, #FDE6B8 0%, #F0C980 100%)',
                  boxShadow: 'var(--lip)',
                }}
              >
                3
              </div>
              <h3 className="text-lg font-black text-[#232D3C]">باشر البيع وراقب أرباحك</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed font-normal">
                ابدأ البيع عبر الكاشير وتطبيق المناديب، واستمتع بتقارير الأرباح والخزينة الحية لحظة بلحظة.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ⚡ INTEGRATIONS & COMPATIBILITY (شبكة التوافق والربط الشامل)               */}
      {/* ========================================================================= */}
      <section id="integrations" className="relative z-20 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2A7A62] bg-[#B2E7D2]/60 px-3 py-1 rounded-full">
            التوافق والتكامل
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#232D3C] mt-3">
            يتكامل بسلاسة مع أدواتك وأجهزتك الحالية
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto mt-3 font-normal">
            لن تحتاج لشراء أجهزة خاصة أو معقدة؛ إنجاز برو يعمل على ما تملكه الآن بنقرة زر واحدة
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-10">
            {integrations.map((item, index) => (
              <div
                key={index}
                className="px-4 py-2.5 rounded-full flex items-center gap-2.5 transition-all hover:-translate-y-0.5 cursor-default text-xs font-bold text-slate-800"
                style={{
                  background: 'var(--gloss)',
                  boxShadow: 'var(--lift), var(--lip)',
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: item.dot, boxShadow: '0 2px 4px rgba(35,45,60,0.15)' }}
                />
                <span>{item.name}</span>
                <span className="text-[10px] text-slate-400 font-normal mr-1">({item.desc})</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 📊 THE STATPLATE (لوحة الأرقام القياسية)                                   */}
      {/* ========================================================================= */}
      <section className="relative z-20 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div
            className="rounded-[36px] p-8 sm:p-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center border border-white/90"
            style={{
              background: 'linear-gradient(160deg, #FAFCFF, var(--plate) 46%, var(--plate-2))',
              boxShadow: 'var(--clay)',
            }}
          >
            <div>
              <div className="text-4xl sm:text-5xl font-black text-[#232D3C] font-mono">99.8%</div>
              <p className="text-xs sm:text-sm font-bold text-slate-600 mt-2">
                دقة احتساب الأرباح ومنع العجز المالي
              </p>
            </div>
            <div className="sm:border-x sm:border-slate-200/70 sm:px-4">
              <div className="text-4xl sm:text-5xl font-black text-[#2A7A62] font-mono">2 دقيقة</div>
              <p className="text-xs sm:text-sm font-bold text-slate-600 mt-2">
                من إنشاء الحساب وحتى إصدار أول فاتورة بيع
              </p>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-black text-blue-700 font-mono">1,800+</div>
              <p className="text-xs sm:text-sm font-bold text-slate-600 mt-2">
                تاجر ومندوب ومؤسسة تجارية تعتمد علينا يومياً
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 💬 CUSTOMER STORIES (قصص نجاح التجار مع إنجاز برو)                         */}
      {/* ========================================================================= */}
      <section className="relative z-20 py-20 bg-white/40 border-y border-slate-200/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 text-right">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#2A7A62] bg-[#B2E7D2]/60 px-3 py-1 rounded-full">
                قصص واقعية
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#232D3C] mt-3">
                ماذا تغيّر بعد التخلي عن الدفاتر والبرامج المعقدة؟
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStory((prev) => (prev > 0 ? prev - 1 : stories.length - 1))}
                className="p-2.5 rounded-full text-slate-700 transition-transform active:scale-90"
                style={{ background: 'var(--gloss)', boxShadow: 'var(--lift), var(--lip)' }}
                aria-label="السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-500 px-2">
                0{activeStory + 1} / 0{stories.length}
              </span>
              <button
                onClick={() => setActiveStory((prev) => (prev < stories.length - 1 ? prev + 1 : 0))}
                className="p-2.5 rounded-full text-slate-700 transition-transform active:scale-90"
                style={{ background: 'var(--gloss)', boxShadow: 'var(--lift), var(--lip)' }}
                aria-label="التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Story Card (Celadon Quote Style) */}
          <div
            className="rounded-[32px] p-8 sm:p-12 text-right relative border border-white/90 animate-fade-in"
            style={{
              background: 'linear-gradient(160deg, #FAFCFF, var(--plate) 46%, var(--plate-2))',
              boxShadow: 'var(--clay)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: stories[activeStory].tagColor }}
                />
                <span className="text-xs font-bold text-slate-500">تجربة تاجر معتمد</span>
              </div>
              <span className="text-xs font-bold text-[#0E3A2E] bg-[#B2E7D2] px-3 py-1 rounded-full">
                🏆 {stories[activeStory].result}
              </span>
            </div>

            <blockquote className="text-lg sm:text-xl font-bold text-[#232D3C] leading-relaxed">
              "{stories[activeStory].quote}"
            </blockquote>

            <div className="mt-8 pt-6 border-t border-slate-200/70 flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm text-[#0E3A2E]"
                style={{ background: 'var(--gloss-jade)', boxShadow: 'var(--lip-jade)' }}
              >
                {stories[activeStory].initials}
              </div>
              <div>
                <b className="text-sm font-black text-[#232D3C] block">{stories[activeStory].author}</b>
                <span className="text-xs text-slate-500 font-medium">{stories[activeStory].role}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🛍️ CUSTOM E-COMMERCE STORES (تصميم وبرمجة متاجر إلكترونية متكاملة)           */}
      {/* ========================================================================= */}
      <StoreDesignSection
        onOpenInquiryModal={() => setIsStoreInquiryModalOpen(true)}
        onWhatsApp={handleWhatsApp}
      />

      {/* ========================================================================= */}
      {/* 💰 PRICING WITH INTERACTIVE BILLING SWITCHER (الأسعار الكلايمورفزم)         */}
      {/* ========================================================================= */}
      <section id="pricing" className="relative z-20 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2A7A62] bg-[#B2E7D2]/60 px-3 py-1 rounded-full">
            خطة اشتراك واحدة وشفافة
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#232D3C] mt-3">
            استثمار بسيط يُحدث نقلة نوعية في تجارتك
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2 font-normal">
            ادفع مقابل المنظومة السحابية بالكامل — كل المميزات مفتوحة بدون قيود وبدون أي رسوم خفية
          </p>

          {/* Interactive Billing Switcher */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span
              onClick={() => setBillingCycle('monthly')}
              className={`text-xs font-bold cursor-pointer transition-colors ${!isYearly ? 'text-[#232D3C] font-black' : 'text-slate-400'
                }`}
            >
              دفع شهري
            </span>
            <div
              onClick={() => setBillingCycle(isYearly ? 'monthly' : 'yearly')}
              className="w-14 h-8 rounded-full p-1 cursor-pointer transition-colors relative"
              style={{ background: 'var(--sunk)', boxShadow: 'var(--well)' }}
            >
              <div
                className={`w-6 h-6 rounded-full transition-transform duration-300 shadow-sm ${isYearly ? '-translate-x-6 bg-[#2A7A62]' : 'translate-x-0 bg-white'
                  }`}
                style={{
                  boxShadow: '0 2px 5px rgba(35,45,60,0.3)',
                }}
              />
            </div>
            <span
              onClick={() => setBillingCycle('yearly')}
              className={`text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${isYearly ? 'text-[#232D3C] font-black' : 'text-slate-400'
                }`}
            >
              <span>دفع سنوي</span>
              <span className="text-[10px] font-black text-[#0E3A2E] bg-[#B2E7D2] px-2.5 py-0.5 rounded-full">
                وفر شهرين مجاناً 🎁
              </span>
            </span>
          </div>

          {/* Single All-in-One Pricing Card */}
          <div className="max-w-2xl mx-auto mt-12 text-right">
            <div
              className="rounded-[36px] p-8 sm:p-12 border-2 border-[#7CCFB0] relative transition-all shadow-2xl"
              style={{
                background: 'linear-gradient(158deg, #FCFEFF, #F1F6FD 46%, #E7EEFA)',
                boxShadow: '0 28px 48px -20px rgba(42, 122, 98, .45), var(--clay)',
              }}
            >
              <div className="absolute -top-4 right-1/2 translate-x-1/2 bg-[#2A7A62] text-white text-xs font-black px-5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap">
                <span>🌟</span>
                <span>الباقة الشاملة المتكاملة (All-in-One)</span>
              </div>

              <div className="text-center pb-8 border-b border-slate-200/70">
                <span className="text-xs font-black text-[#2A7A62] uppercase tracking-wider block">
                  اشتراك المنظومة السحابية (POS، المخازن، الفروع، والخزينة)
                </span>
                <div className="flex items-baseline justify-center gap-1.5 mt-3">
                  <span className="text-5xl sm:text-6xl font-black font-mono text-[#232D3C]">
                    {isYearly ? '3,000' : '300'}
                  </span>
                  <span className="text-sm font-bold text-slate-500">
                    ج.م / {isYearly ? 'سنة' : 'شهر'}
                  </span>
                </div>
                <p className="text-xs text-[#2A7A62] font-bold mt-2">
                  {isYearly ? 'تُدفع سنوياً (تعادل 250 ج.م فقط شهرياً — وفرت شهرين كاملين!)' : 'تُدفع شهرياً وتجدد عند الرغبة بدون أي التزام'}
                </p>
                <p className="text-xs text-slate-600 mt-3 max-w-md mx-auto leading-relaxed font-normal">
                  منظومة سحابية متكاملة تمنحك نقطة البيع للمحل، الفروع والمستودعات، تطبيق المناديب، والخزن والورديات، في شاشة واحدة.
                </p>

                {/* Transparency Notice about Custom Online Store vs Cloud System */}
                <div className="mt-5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-right space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                    <span>💡</span>
                    <span>توضيح للشفافية التامة:</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    هذا الاشتراك يغطي برنامج السحابي للكاشير والمخازن والمناديب وإدارة المحلات. إذا كنت ترغب في أن نقوم بـ <b>تصميم وتطوير متجر إلكتروني متكامل وخاص بك من الصفر</b>، فذلك مشروع تطوير مستقل لمرة واحدة يُحدد تكلفته حسب حجم ونوع نشاطك عبر{' '}
                    <a href="#ecommerce-store" className="font-bold underline text-amber-950 hover:text-emerald-800">
                      طلب استشارة وتصميم المتجر من هنا
                    </a>.
                  </p>
                </div>
              </div>

              {/* Grid of All Features Included */}
              <div className="mt-8 pt-2">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 text-center">
                  كل ما تحتاجه لإدارة تجارتك ومحلك بنجاح مشمول بالكامل:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-slate-800">
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>كاشير نقاط بيع سريع (POS) يدعم المقاسات والألوان والباركود</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>جاهز للربط التلقائي واللحظي مع متجرك الإلكتروني (اختياري)</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>فروع ومخازن متعددة وأذون تحويل البضاعة الرسمية</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>فصل الخزن والعهد والرقابة الصارمة على الورديات والدرج</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>موديول الرواتب والعمولات (بائعين، كاشير، مناديب، ومدير)</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>تطبيق المناديب والمبيعات الميدانية مع طباعة بلوتوث</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>تقارير الأرباح الصافية الحقيقية (COGS) وتصدير Excel</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-bold p-2 rounded-xl bg-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#2A7A62] shrink-0" />
                    <span>دعم فني مباشر وتحديثات سحابية مستمرة بدون رسوم</span>
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="mt-8 pt-4 text-center">
                <Link
                  to="/register"
                  className="w-full py-4 rounded-full text-sm font-black text-[#0E3A2E] text-center transition-all block shadow-md active:scale-95"
                  style={{
                    backgroundImage: 'var(--gloss-jade)',
                    boxShadow: 'var(--lift-jade-hi), var(--lip-jade)',
                  }}
                >
                  ابدأ تجربتك المجانية الكاملة (14 يوم اً) الآن
                </Link>
                <p className="text-[11px] text-slate-400 mt-2.5">
                  لا نطلب أي بطاقة بنكية — تفعيل فوري في 60 ثانية
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ❓ FAQ SECTION (الأسئلة الشائعة بنمط الكلايمورفزم)                         */}
      {/* ========================================================================= */}
      <section id="faq" className="relative z-20 py-20 bg-white/40 border-y border-slate-200/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#2A7A62] bg-[#B2E7D2]/60 px-3 py-1 rounded-full">
            إجابات واضحة
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#232D3C] mt-3">
            أسئلة شائعة تدور في ذهنك
          </h2>

          <div className="space-y-3 mt-10 text-right">
            {[
              {
                q: 'هل أحتاج لامتلاك متجر إلكتروني حتى أستخدم نظام إنجاز برو في محلي التجاري؟',
                a: 'لا إطلاقاً! إنجاز برو يعمل بشكل مستقل تماماً كنظام متكامل لإدارة كاشير المحلات ونقاط البيع (POS)، المخازن والمستودعات، المقاسات والألوان بالباركود، وخزن الفروع والمناديب. ميزة الربط مع المتاجر الإلكترونية هي ميزة إضافية اختيارية تماماً لمن يرغب في التوسع بالبيع أونلاين بجانب محله أو معارضه.',
              },
              {
                q: 'هل اشتراك الـ 3,000 ج.م السنوي يشمل تكلفة تصميم وبرمجة المتجر الإلكتروني؟',
                a: 'اشتراك الـ 3,000 ج.م السنوي مخصص لرخصة تشغيل المنظومة السحابية (الكاشير، المخازن، الفروع المتعددة، الخزينة والورديات، وتطبيق المناديب). أما خدمة تصميم وبرمجة متجر إلكتروني مخصص لعلامتك التجارية فهي مشروع تطوير مستقل يُدفع لمرة واحدة حسب حجم وهوية نشاطك، ويتم ربطه تلقائياً مع نظام إنجاز برو بدون أي عمولة على مبيعاتك.',
              },
              {
                q: 'هل أحتاج لشراء جهاز كاشير محدد أو كمبيوتر بمواصفات معقدة؟',
                a: 'إطلاقاً! منظومة إنجاز برو سحابية PWA وتعمل على أي جهاز تملكه: لابتوب، جهاز كمبيوتر، شاشة كاشير تعمل باللمس، هاتف ذكي (أندرويد أو آيفون)، أو جهاز تابلت، دون الحاجة لتحميل برامج ثقيلة.',
              },
              {
                q: 'هل يمكنني استيراد أصنافي السابقة وقائمة العملاء من ملف Excel؟',
                a: 'نعم بكل سهولة. النظام يوفر شاشة استيراد ذكية تمكنك من رفع ملف Excel يحتوي على آلاف الأصناف والأسعار وأرصدة المخزون والعملاء في ثوانٍ معدودة.',
              },
              {
                q: 'كيف يمنع إنجاز برو عجز الخزينة وتسريب الأموال؟',
                a: 'النظام يفصل الخزينة الرئيسية عن أدراج الكاشير وعهد المناديب. عند تقفيل الوردية، يطلب النظام جرد المبلغ الفعلي في الدرج ويقارنه بحركة المبيعات لحظة بلحظة، ويسجل أي فارق تلقائياً ولا يسمح بتعديل السجلات.',
              },
              {
                q: 'كيف تتم مزامنة متجر WooCommerce الإلكتروني؟',
                a: 'الربط يتم بخطوتين عبر إدخال مفاتيح API الخاصة بمتجرك. بمجرد إتمام أي بيع في المعرض أو على المتجر، يتم تحديث رصيد الصنف وسعر البيع في الطرفين لحظياً مع سحب الأوردرات تلقائياً.',
              },
              {
                q: 'هل يمكن للمندوب طباعة فواتير في الشارع أمام العميل؟',
                a: 'تطبيق أندرويد EngazPRO يدعم طباعة الإيصالات على طابعات ESC/POS الحرارية (58mm و80mm) المقترنة عبر البلوتوث، مع إمكان مشاركة الفاتورة فوراً عبر واتساب إن لم تكن الطابعة متاحة. صفحة التسويق هذه للويب؛ التطبيق يفتح مباشرة على تسجيل الدخول.',
              },
              {
                q: 'ماذا يحدث بعد انتهاء فترة التجربة المجانية (14 يوم اً)؟',
                a: 'بياناتك تظل محفوظة بأمان تام. يمكنك اختيار الخطة المناسبة لك ومتابعة العمل بسلاسة، أو التوقف دون أي التزام أو خصم مالي.',
              },
            ].map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={index}
                  onClick={() => toggleFaq(index)}
                  className="rounded-3xl p-5 cursor-pointer transition-all border border-white/80"
                  style={{
                    background: isOpen ? 'var(--gloss-plate)' : 'var(--plate)',
                    boxShadow: isOpen ? 'var(--clay)' : 'var(--clay-sm)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-black text-[#232D3C]">{faq.q}</h3>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform ${isOpen ? 'rotate-180 bg-[#B2E7D2] text-[#0E3A2E]' : 'bg-[#DCE4F3] text-slate-600'
                        }`}
                      style={{ boxShadow: 'var(--well)' }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-200/60 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal animate-fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🏁 FINAL GRAND CALL TO ACTION PLATE (لوحة الدعوة الختامية)                 */}
      {/* ========================================================================= */}
      <section className="relative z-20 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div
            className="rounded-[40px] p-8 sm:p-16 text-center relative overflow-hidden border border-white/90"
            style={{
              background: 'linear-gradient(158deg, #FCFEFF, #F1F6FD 46%, #E7EEFA)',
              boxShadow: '0 34px 54px -24px rgba(35, 45, 60, .38), var(--clay)',
            }}
          >
            <span className="text-xs font-black text-[#2A7A62] bg-[#B2E7D2] px-4 py-1.5 rounded-full inline-block mb-4">
              جاهز لتطوير تجارتك؟
            </span>

            <h2 className="text-3xl sm:text-5xl font-black text-[#232D3C] leading-tight max-w-2xl mx-auto">
              ابدأ الآن مجاناً وانقل عملك لمستوى جديد من الدقة والربحية
            </h2>

            <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mt-4 leading-relaxed font-normal">
              انضم لأكثر من 1,800 تاجر استعادوا السيطرة الكاملة على أموالهم ومخازنهم وفروعهم مع إنجاز برو.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link
                to="/register"
                className="w-full sm:w-auto px-9 py-4 rounded-full text-base font-black text-[#0E3A2E] transition-all flex items-center justify-center gap-2 group active:scale-95 shadow-md"
                style={{
                  backgroundImage: 'var(--gloss-jade)',
                  boxShadow: 'var(--lift-jade-hi), var(--lip-jade)',
                }}
              >
                <span>إنشاء حسابي والبدء فوراً</span>
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1.5 transition-transform" />
              </Link>
              <button
                type="button"
                onClick={() => handleWhatsApp('مرحباً، أود الاستفسار عن تجربة إنجاز برو')}
                className="w-full sm:w-auto px-8 py-4 rounded-full text-base font-bold text-slate-800 transition-all flex items-center justify-center gap-2.5 active:scale-95 border border-white/60"
                style={{
                  background: 'var(--gloss)',
                  boxShadow: 'var(--lift), var(--lip)',
                }}
              >
                <MessageCircle className="w-5 h-5 text-[#2A7A62]" />
                <span>محادثة فريق المبيعات</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs font-bold text-slate-500 mt-6">
              <span>✓ تجربة 14 يوم اً كاملة</span>
              <span>✓ لا نطلب بطاقة ائتمان</span>
              <span>✓ دعم فني متواصل</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 📄 FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="relative z-20 py-12 border-t border-slate-200/60 bg-[#EAF0FA]/60 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tighter text-slate-900 font-sans">
                Engaz<span className="text-[#2A7A62]">.</span>PRO
              </span>
              <span className="text-slate-400">| منظومة نقاط البيع والخزن والمخزون السحابية</span>
            </Link>

            <div className="flex items-center gap-6 font-bold text-slate-600">
              <a href="#features" className="hover:text-slate-900">المميزات</a>
              <a href="#pricing" className="hover:text-slate-900">الأسعار</a>
              <a href="#faq" className="hover:text-slate-900">الأسئلة الشائعة</a>
              <button
                type="button"
                onClick={() => handleWhatsApp('مرحباً')}
                className="hover:text-slate-900 flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#2A7A62]" /> الدعم الفني
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <p>© {new Date().getFullYear()} منظومة إنجاز برو (Engaz Pro). جميع الحقوق محفوظة.</p>
            <p>ربط متجرك الإلكتروني لحظياً.</p>
          </div>
        </div>
      </footer>

      {/* Store Inquiry Modal */}
      <StoreInquiryModal
        isOpen={isStoreInquiryModalOpen}
        onClose={() => setIsStoreInquiryModalOpen(false)}
      />
    </div>
  );
};
