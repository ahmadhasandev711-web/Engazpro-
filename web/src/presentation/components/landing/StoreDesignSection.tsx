import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Globe,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Card } from '../ui';
import { STORE_ADVANTAGES } from './landingContent';

interface StoreDesignSectionProps {
  onOpenInquiry: () => void;
  onWhatsApp: (text: string) => void;
}

/**
 * Custom WordPress (WooCommerce) & Shopify store design service banner connected to EBMS stock and orders.
 */
export const StoreDesignSection: React.FC<StoreDesignSectionProps> = ({
  onOpenInquiry,
  onWhatsApp,
}) => {
  return (
    <section id="custom-store" className="scroll-mt-24 relative z-20 py-16 sm:py-20 bg-surface-2/60 border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge tone="brand">تصميم وتجهيز المتاجر الإلكترونية (WordPress & Shopify)</Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-ink leading-tight">
            نُصمم لك متجر Shopify أو WordPress احترافياً
            <span className="text-brand"> ونربطه مباشرة بالكاشير والمخازن</span>
          </h2>
          <p className="text-sm sm:text-base text-muted leading-relaxed">
            سواء كنت تبدأ بيعاً أونلاين من الصفر أو تطور متجرك الحالي: فريقنا ينفذ متجرك على <strong>WordPress / WooCommerce</strong> أو <strong>Shopify</strong> بتصميم حديث، ويفعّل عليه بوابات الدفع الإلكتروني وشركات الشحن، مع ربطه بمخزون إنجاز برو فوراً.
          </p>
        </div>

        <Card className="p-5 sm:p-8 shadow-xl bg-panel border-brand/25">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 space-y-3 text-right">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">WordPress / WooCommerce</Badge>
                <Badge tone="ok">Shopify</Badge>
              </div>
              <h3 className="text-lg sm:text-2xl font-black text-ink">
                كل طلب من متجرك ينزل في شاشة الكاشير جاهزاً للشحن
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                بمجرد استلام طلب جديد على متجرك الإلكتروني (سواء الدفع أونلاين عبر الفيزا والمحافظ على المتجر أو الدفع عند الاستلام)، يتم حجز المقاس واللون تلقائياً من فرعك وإرسال الطلب لشاشة الكاشير والشحن.
              </p>

              <ul className="space-y-2 pt-1 text-xs sm:text-sm font-semibold text-ink">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  <span>تهيئة بوابات الدفع الإلكتروني على متجرك (Paymob، Fawry، البطاقات)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  <span>مزامنة الأسعار والمقاسات والألوان بين المحل والأونلاين أوتوماتيك</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  <span>سرعة تصفح ممتازة على الموبايل وتهيئة كاملة للظهور في جوجل (SEO)</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden border border-line bg-canvas shadow-md">
                <div className="bg-surface-2 border-b border-line px-3.5 py-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-ink flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-brand" />
                    شاشة طلبات المتجر داخل EBMS
                  </span>
                  <Badge tone="ok">مزامنة حية</Badge>
                </div>
                <img
                  src="/screenshots/store-orders.webp"
                  alt="لقطة حقيقية لشاشة استلام وإدارة طلبات متاجر WordPress و Shopify داخل إنجاز برو"
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STORE_ADVANTAGES.map((adv) => {
            const Icon = adv.icon;
            return (
              <Card key={adv.title} className="space-y-2.5 bg-panel">
                <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-ink">{adv.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{adv.desc}</p>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 sm:p-8 bg-panel border-brand/30 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-md">
          <div className="text-right space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-brand font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>التكلفة تُحدد حسب تفاصيل المتجر ونوع المنصة (Shopify أو WordPress)</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-ink">
              هل تريد تصميم متجر إلكتروني خاص بك مربوط بمخازنك؟
            </h3>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0" />
                معاينة نماذج متاجر فعلية قبل البدء
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0" />
                عرض سعر واضح ومفصل حسب احتياجات نشاطك
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full sm:w-auto shadow-md"
              onClick={onOpenInquiry}
              rightIcon={<ArrowLeft className="w-4 h-4 shrink-0" />}
            >
              اطلب تصميم متجرك الآن
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              leftIcon={<MessageCircle className="w-4 h-4 text-ok shrink-0" />}
              onClick={() =>
                onWhatsApp(
                  'مرحباً، أرغب في الحصول على عرض سعر لتصميم متجر إلكتروني (WordPress أو Shopify) مربوط بنظام إنجاز برو EBMS.'
                )
              }
            >
              اطلب عرض سعر واتساب
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
};
