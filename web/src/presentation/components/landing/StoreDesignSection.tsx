import React from 'react';
import {
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Printer,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
} from 'lucide-react';
import { Badge, Button, Card } from '../ui';

interface StoreDesignSectionProps {
  onOpenInquiryModal: () => void;
  onWhatsApp: (text: string) => void;
}

const STORE_ADVANTAGES = [
  {
    title: 'تصميم بهوية براندك وتجربة شراء بلمسة',
    desc: 'واجهة متجر عصرية متجاوبة تماماً مع شاشات الموبايل؛ مصممة لرفع معدل التحويل وإتمام الطلبات بدون خطوات معقدة.',
    icon: Smartphone,
    toneClass: 'bg-brand-soft text-brand-ink border-brand/20',
  },
  {
    title: 'مزامنة ثنائية 100% مع الكاشير والمخزن',
    desc: 'الصنف المضاف في المحل يظهر فوراً في متجرك، وأي مبيعة أونلاين تخصم رصيدها من مخزن الفرع تلقائياً بدون إدخال مزدوج.',
    icon: Repeat,
    toneClass: 'bg-ok-soft text-ok-ink border-ok/20',
  },
  {
    title: 'بوابات دفع إلكتروني وشركات شحن',
    desc: 'دعم فيزا وماستركارد، إنستاباي، والمحافظ الإلكترونية مع إصدار بوليصة الشحن وتجهيزها للمندوب مباشرة.',
    icon: CreditCard,
    toneClass: 'bg-info-soft text-info-ink border-info/20',
  },
  {
    title: 'صفر عمولة على المبيعات والملكية لك',
    desc: 'لا نقتطع أي نسبة من أرباحك اليومية؛ متجرك وقاعدة عملائك ونطاقك الخاص ملك لك بالكامل.',
    icon: ShieldCheck,
    toneClass: 'bg-warn-soft text-warn-ink border-warn/20',
  },
] as const;

/**
 * Custom e-commerce storefront design service synchronized natively with EngazPRO POS & inventory.
 */
export const StoreDesignSection: React.FC<StoreDesignSectionProps> = ({
  onOpenInquiryModal,
  onWhatsApp,
}) => {
  return (
    <section
      id="custom-store"
      className="scroll-mt-24 relative z-10 py-16 sm:py-20 bg-panel/60 border-y border-line"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge tone="brand">خدمة اختيارية مستقلة لمتجرك الإلكتروني</Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-ink leading-tight">
            تحتاج متجر إلكتروني خاصاً بك؟{' '}
            <span className="text-brand">نصممه ونربطه مباشرة بالكاشير والمخزن</span>
          </h2>
          <p className="text-sm sm:text-base text-muted leading-relaxed">
            نصمم ونطور متجرك الإلكتروني بهوية براندك الخاصة ونربطه لحظياً بمنظومة إنجاز برو: عميلك يطلب أونلاين، والطلب ينزل تلقائياً على شاشة الكاشير مع خصم المخزون وتجهيز الشحنة.
          </p>
        </div>

        {/* Dual Device Showcase: Mobile Storefront <-> Cashier & Printer */}
        <Card className="relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Customer Mobile Storefront Mockup */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="text-xs font-bold text-muted mb-3 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-brand" />
                <span>واجهة متجرك على موبايل العميل</span>
              </div>

              <div className="w-full max-w-[320px] rounded-3xl border border-line bg-canvas p-4 space-y-3 shadow-sm text-right">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand text-on-brand flex items-center justify-center font-black text-xs">
                      E
                    </div>
                    <span className="font-black text-xs text-ink">براند ستور</span>
                  </div>
                  <Badge tone="brand">سلة (1)</Badge>
                </div>

                <div className="rounded-2xl bg-panel border border-line p-3 space-y-2.5">
                  <div className="h-24 rounded-xl bg-brand-soft border border-brand/20 flex items-center justify-center relative">
                    <ShoppingBag className="w-8 h-8 text-brand" />
                    <span className="absolute top-2 right-2">
                      <Badge tone="ok">خصم 20%</Badge>
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-xs text-ink">سنيكرز كاجوال مريح</div>
                      <div className="text-[11px] text-muted">كود: SNK-809 | مقاس 42</div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="text-xs font-black text-brand tabular-nums">680 ج.م</div>
                      <div className="text-[11px] text-muted line-through tabular-nums">850 ج.م</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-surface-2 border border-line p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-ink">
                    <span>الدفع السريع المتاح:</span>
                    <span className="text-muted tabular-nums" dir="ltr">
                      0109988****
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">فيزا / ماستركارد</Badge>
                    <Badge tone="brand">إنستاباي</Badge>
                    <Badge tone="ok">فودافون كاش</Badge>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    leftIcon={<ShoppingBag className="w-3.5 h-3.5 shrink-0" />}
                    onClick={onOpenInquiryModal}
                  >
                    تأكيد الطلب الآن
                  </Button>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ok-soft border border-ok/20 text-[11px] font-bold text-ok-ink">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>تم تأكيد الطلب رقم 8942 وتحويله للكاشير</span>
                </div>
              </div>
            </div>

            {/* Center Sync Conduit */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center gap-2.5 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/25 text-brand flex items-center justify-center">
                <Repeat className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black text-ink block">مزامنة فورية 100%</span>
                <span className="text-[11px] text-muted leading-relaxed block">
                  الطلب يظهر على شاشة الكاشير ويُخصم من المخزون لحظياً
                </span>
              </div>
              <Badge tone="info">Webhook API</Badge>
            </div>

            {/* Branch POS Terminal Mockup */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="text-xs font-bold text-muted mb-3 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-info" />
                <span>شاشة كاشير ومخازن إنجاز برو في الفرع</span>
              </div>

              <div className="w-full max-w-[350px] rounded-3xl border border-line bg-canvas p-4 space-y-3 shadow-sm text-right">
                <div className="flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-ok" />
                    <span className="text-xs font-black text-ink">نقطة بيع الفرع الرئيسي</span>
                  </div>
                  <Badge tone="info">أوردر متجر وارد</Badge>
                </div>

                <div className="rounded-2xl bg-panel border border-line p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-ink">أوردر أونلاين #OR-8942</span>
                    <Badge tone="ok">مدفوع</Badge>
                  </div>
                  <div className="text-[11px] text-muted">
                    العميل: كريم السعيد — المعادي
                  </div>
                  <div className="p-2 rounded-xl bg-surface-2 border border-line flex items-center justify-between text-[11px]">
                    <span className="font-bold text-ink">سنيكرز كاجوال (42)</span>
                    <span className="font-bold text-ok tabular-nums">المخزون: 19 (-1)</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-warn-soft border border-dashed border-warn/40 p-3 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-warn-ink">
                    <span className="flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5" />
                      <span>إيصال التجهيز والشحن الحراري</span>
                    </span>
                    <span>80mm</span>
                  </div>
                  <div className="border-t border-warn/25 pt-1 text-ink space-y-0.5 leading-relaxed">
                    <div>بوليصة الشحن: SHP-2026-8942</div>
                    <div>الإجمالي المسدد: 680 ج.م</div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0" />}
                  onClick={onOpenInquiryModal}
                >
                  جاهز للتسليم لمندوب الشحن
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 4 Key Advantages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-right">
          {STORE_ADVANTAGES.map((adv) => {
            const Icon = adv.icon;
            return (
              <Card key={adv.title} className="space-y-3">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${adv.toneClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-ink">{adv.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{adv.desc}</p>
              </Card>
            );
          })}
        </div>

        {/* Service CTA Strip */}
        <Card className="bg-surface-2 border-brand/25">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-right">
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-2xl font-black text-ink">
                جاهز لإطلاق متجرك الإلكتروني المربوط بالكاشير والمخزن؟
              </h3>
              <p className="text-xs sm:text-sm text-muted">
                احصل على استشارة مجانية لدراسة نشاطك، مع عرض نماذج المتاجر وخطة الربط الكاملة.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto font-black"
                leftIcon={<Sparkles className="w-4 h-4 shrink-0" />}
                onClick={onOpenInquiryModal}
              >
                اطلب تصميم متجرك الآن
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto font-bold"
                leftIcon={<MessageCircle className="w-4 h-4 text-ok shrink-0" />}
                onClick={() =>
                  onWhatsApp(
                    'مرحباً، أود الاستفسار عن خدمة تصميم وتطوير متجر إلكتروني متكامل وربطه مع كاشير ومخازن إنجاز برو.'
                  )
                }
              >
                تواصل واتساب
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 text-xs font-semibold text-muted mt-6 pt-5 border-t border-line">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-ok" />
              استشارة مجانية لدراسة نشاطك التجاري
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-ok" />
              تسليم وتدريب متكامل للفريق
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-ok" />
              دعم فني ومزامنة مستمرة
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
};
