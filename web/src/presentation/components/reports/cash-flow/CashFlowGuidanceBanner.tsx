import React from 'react';
import { Info } from 'lucide-react';

export const CashFlowGuidanceBanner: React.FC = () => {
  return (
    <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-xs">
      <div className="p-1.5 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
        <Info className="w-4 h-4" />
      </div>
      <div className="space-y-0.5">
        <p className="font-bold text-amber-950">
          طبيعة هذا التقرير: تقرير التدفقات والمتحصلات المحصلة خلال الفترة المحددة
        </p>
        <p className="text-amber-800 leading-relaxed text-[11px]">
          يوضح هذا التقرير صافي الإيرادات والمبيعات المقبوضة مطروحاً منها المصروفات بحسب قناة الدفع (كاش، فيزا، إنستاباي، فودافون كاش، تحويل).
          أما <strong>الأرصدة اللحظية الفعلية للخزائن النقدية والحسابات البنكية والمحافظ</strong>، فتتابعها وتديرها بدقة لحظة بلحظة من شاشة{' '}
          <span className="font-bold text-amber-950 underline">إدارة الخزن والحسابات</span>.
        </p>
      </div>
    </div>
  );
};
