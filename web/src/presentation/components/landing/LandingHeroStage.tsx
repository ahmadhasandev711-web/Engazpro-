import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { Badge, Button } from '../ui';

interface LandingHeroStageProps {
  trialDays: number;
  onWhatsApp: (text: string) => void;
}

type SimulatorMode = 'pos' | 'shift' | 'courier' | 'woo';

const SIMULATOR_TABS: { id: SimulatorMode; label: string; icon: React.ReactNode }[] = [
  { id: 'pos', label: 'كاشير POS', icon: <Receipt className="w-4 h-4" /> },
  { id: 'shift', label: 'تقفيل الوردية', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'courier', label: 'عهدة المندوب', icon: <Truck className="w-4 h-4" /> },
  { id: 'woo', label: 'ووكومرس لحظي', icon: <ShoppingBag className="w-4 h-4" /> },
];

/** Hero value proposition + 4-mode interactive EngazPRO system simulator. */
export const LandingHeroStage: React.FC<LandingHeroStageProps> = ({ trialDays, onWhatsApp }) => {
  const [simMode, setSimMode] = useState<SimulatorMode>('pos');
  const [demoCartItems, setDemoCartItems] = useState<number>(2);
  const [demoCartTotal, setDemoCartTotal] = useState<number>(1120);

  const handleAddDemoBarcode = () => {
    setDemoCartItems((prev) => prev + 1);
    setDemoCartTotal((prev) => prev + 380);
  };

  return (
    <section className="relative z-20 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-panel border border-line shadow-xs mb-6">
          <Badge tone="ok" dot>
            منظومة سحابية متكاملة
          </Badge>
          <span className="text-xs font-bold text-muted">
            كاشير POS • خزن وورديات • مناديب • ربط WooCommerce
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-ink tracking-tight leading-[1.2] max-w-4xl mx-auto">
          أغلق ثغرات العجز والهدر..
          <br />
          <span className="text-brand">وأدِر فروعك ومناديبك من شاشة واحدة</span>
        </h1>

        <p className="text-sm sm:text-lg text-muted max-w-2xl mx-auto mt-5 leading-relaxed font-normal">
          ليس مجرد برنامج كاشير لطباعة البون! <strong className="text-ink">إنجاز برو</strong> يفصل درج الكاشير
          عن الخزينة الرئيسية وعهد المناديب، ويطابق وردياتك بالقرش مع مزامنة لحظية لمتجرك الإلكتروني.
        </p>

        {/* Primary & Sales CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-8">
          <Link
            to="/register"
            className="w-full sm:w-auto min-h-[52px] px-8 rounded-full bg-brand text-on-brand text-sm sm:text-base font-black inline-flex items-center justify-center gap-2.5 hover:bg-brand-ink transition-all shadow-lg active:scale-95"
          >
            <span>ابدأ تجربتك المجانية ({trialDays} يوم بدون بطاقة)</span>
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => onWhatsApp('مرحباً، أود حجز عرض توضيحي ومعرفة تفاصيل الاشتراك في منظومة إنجاز برو.')}
            leftIcon={<MessageCircle className="w-5 h-5 text-ok" />}
            className="w-full sm:w-auto min-h-[52px] rounded-full px-7 font-bold"
          >
            استشر فريق المبيعات عبر واتساب
          </Button>
        </div>

        <p className="text-xs text-muted font-medium mt-3.5">
          تفعيل فوري في 60 ثانية بدون بطاقة بنكية — يعمل على الكمبيوتر والتابلت والموبايل.
        </p>

        {/* Interactive 4-Mode Live Product Simulator */}
        <div id="simulator" className="scroll-mt-24 mt-12 max-w-5xl mx-auto text-right">
          <div className="bg-panel rounded-3xl p-4 sm:p-6 border border-line shadow-2xl">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-bad" />
                <span className="w-3 h-3 rounded-full bg-warn" />
                <span className="w-3 h-3 rounded-full bg-ok" />
                <span className="text-xs font-bold text-muted mr-2">
                  جرّب بنفسك شاشات المنظومة الحية:
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="أوضاع المحاكي">
                {SIMULATOR_TABS.map((tab) => {
                  const active = simMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSimMode(tab.id)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-brand text-on-brand shadow-sm'
                          : 'bg-surface-2 text-muted hover:text-ink border border-line'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simulator Content Body */}
            <div className="mt-5">
              {simMode === 'pos' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 bg-surface-2 rounded-2xl p-4 border border-line space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-ink">سلة البيع الفورية — كاشير الفرع الرئيسي</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Plus className="w-3.5 h-3.5 text-brand" />}
                        onClick={handleAddDemoBarcode}
                        className="bg-brand-soft text-brand-ink border-brand/20"
                      >
                        مسح باركود منتج (+380 ج.م)
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="bg-panel border border-line rounded-xl p-3">
                        <div className="font-bold text-ink">تيشيرت بولو قطن (L / كحلي)</div>
                        <div className="mt-1 font-mono font-black text-brand tabular-nums">520.00 ج.م</div>
                      </div>
                      <div className="bg-panel border border-line rounded-xl p-3">
                        <div className="font-bold text-ink">بنطلون جينز سليم (مقاس 32)</div>
                        <div className="mt-1 font-mono font-black text-brand tabular-nums">600.00 ج.م</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-2 rounded-2xl p-4 border border-line flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-muted font-bold">إجمالي الفاتورة ({demoCartItems} أصناف)</span>
                      <div className="text-3xl font-black font-mono text-brand tabular-nums mt-1">
                        {demoCartTotal.toLocaleString('en-US')} <span className="text-xs text-muted">ج.م</span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted">
                        <div className="flex justify-between">
                          <span>نقدي بالدرج:</span>
                          <span className="font-mono font-bold text-ink">800.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>إنستاباي / شبكة:</span>
                          <span className="font-mono font-bold text-ink">{(demoCartTotal - 800).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 py-2 px-3 rounded-xl bg-ok-soft text-ok text-xs font-black flex items-center justify-center gap-1.5 border border-ok/20">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>طباعة حرارية 80mm + إرسال واتساب</span>
                    </div>
                  </div>
                </div>
              )}

              {simMode === 'shift' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">النقدية المتوقعة بالدرج</span>
                    <div className="text-2xl font-black font-mono text-ink tabular-nums">14,350.00 ج.م</div>
                    <span className="text-xs text-muted block">افتتاح 1,000 + مبيعات كاش 13,350</span>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">النقدية المسلمة فعلياً</span>
                    <div className="text-2xl font-black font-mono text-ok tabular-nums">14,350.00 ج.م</div>
                    <Badge tone="ok" dot>
                      مطابق تماماً — 0 عجز مالي
                    </Badge>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">التحويلات المفصولة عن الدرج</span>
                    <div className="text-2xl font-black font-mono text-info tabular-nums">6,800.00 ج.م</div>
                    <span className="text-xs text-muted block">فودافون كاش وإنستاباي في خزائن مستقلة</span>
                  </div>
                </div>
              )}

              {simMode === 'courier' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">عهدة بضاعة المندوب</span>
                    <div className="text-2xl font-black font-mono text-ink tabular-nums">24 قطعة</div>
                    <Badge tone="info">إذن تحويل #TR-89 مؤكد الاستلام</Badge>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">تحصيلات الميدان اليوم (COD)</span>
                    <div className="text-2xl font-black font-mono text-brand tabular-nums">8,500.00 ج.م</div>
                    <span className="text-xs text-muted block">من 7 فواتير ميدانية عبر المتصفح</span>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">حالة التوريد للخزنة الرئيسية</span>
                    <div className="text-base font-black text-ok mt-1">جاهز للتسوية وتقفيل العهدة</div>
                    <span className="text-xs text-muted block">بموافقة أمين الخزينة وسند رسمي</span>
                  </div>
                </div>
              )}

              {simMode === 'woo' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">حالة الربط (Webhook)</span>
                    <div className="text-2xl font-black text-ok">متصل لحظياً ⚡</div>
                    <span className="text-xs text-muted block">آخر طلب مسحوب: رقم 5120</span>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">حماية المخزون (Reservation)</span>
                    <div className="text-base font-black text-ink">حجز فوري من المتاح بالفرع</div>
                    <Badge tone="warn">يمنع البيع المزدوج لنفس القطعة</Badge>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-2xl p-4 space-y-1.5">
                    <span className="text-xs text-muted font-bold block">مزامنة الفروع والمخزن</span>
                    <div className="text-2xl font-black font-mono text-brand">ثنائية الاتجاه</div>
                    <span className="text-xs text-muted block">تحديث الأسعار والأرصدة أوتوماتيكياً</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
