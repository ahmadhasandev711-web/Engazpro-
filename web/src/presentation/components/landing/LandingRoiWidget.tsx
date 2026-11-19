import React, { useState } from 'react';
import { Calculator, Clock, Sparkles } from 'lucide-react';
import { Card } from '../ui';

interface LandingRoiWidgetProps {
  proMonthlyPrice: number;
}

/**
 * Interactive weekly-time-saved & daily-cost value anchor helping merchants compare subscription cost vs leakage prevention.
 */
export const LandingRoiWidget: React.FC<LandingRoiWidgetProps> = ({ proMonthlyPrice }) => {
  const [dailyOrders, setDailyOrders] = useState(45);
  const [staffCount, setStaffCount] = useState(3);

  const weeklyHoursSaved = Math.min(28, Math.max(4, Math.round(dailyOrders * 0.09 + staffCount * 1.4)));
  const dailyCost = (Math.round((proMonthlyPrice / 30) * 10) / 10).toLocaleString('en-US');

  return (
    <Card className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-brand-soft/80 via-panel to-panel border-brand/25 shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-5 text-right">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-brand">
              <Calculator className="w-4 h-4" />
              <span>احسب العائد العملي في نشاطك</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-ink">
              كم ساعة توفّر أسبوعياً من الجرد والتقفيل اليدوي؟
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-2 p-3.5 rounded-2xl bg-panel border border-line">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted">الطلبات اليومية (محل + أونلاين)</span>
                <span className="text-brand font-black tabular-nums">{dailyOrders} طلب</span>
              </div>
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={dailyOrders}
                onChange={(e) => setDailyOrders(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
            </label>

            <label className="block space-y-2 p-3.5 rounded-2xl bg-panel border border-line">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted">الفروع والكاشيرات والمناديب</span>
                <span className="text-brand font-black tabular-nums">{staffCount} نقاط</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={staffCount}
                onChange={(e) => setStaffCount(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-primary-950 text-on-brand p-5 sm:p-6 space-y-4 shadow-md border border-brand/40">
          <div className="grid grid-cols-2 gap-3 text-right">
            <div className="p-3 rounded-xl bg-on-brand/10 border border-on-brand/15">
              <div className="text-2xs text-primary-200 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-ok" />
                <span>توفير أسبوعي</span>
              </div>
              <div className="text-2xl font-black text-on-brand mt-1 tabular-nums">
                ~{weeklyHoursSaved} <span className="text-xs font-bold text-primary-200">ساعة</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-on-brand/10 border border-on-brand/15">
              <div className="text-2xs text-primary-200 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-primary-300" />
                <span>التكلفة اليومية</span>
              </div>
              <div className="text-2xl font-black text-ok mt-1 tabular-nums">
                {dailyCost} <span className="text-xs font-bold text-on-brand">ج/يوم</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-primary-100 leading-relaxed font-medium">
            تكلفة يومية رمزية — ومنع عجز وردية واحد أو شحنة ضائعة يغطي اشتراك النظام بالكامل.
          </p>

          <a
            href="#pricing"
            className="w-full min-h-[42px] rounded-xl bg-panel text-brand-ink hover:bg-brand-soft font-black text-xs flex items-center justify-center transition-colors"
          >
            اختر باقتك وابدأ 14 يوم مجاناً ←
          </a>
        </div>
      </div>
    </Card>
  );
};
