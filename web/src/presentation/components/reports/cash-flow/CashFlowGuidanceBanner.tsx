import React from 'react';
import { Info } from 'lucide-react';

export const CashFlowGuidanceBanner: React.FC = () => {
  return (
    <div className="p-4 bg-warn-soft/70 border border-warn/30 rounded-2xl flex items-start gap-3 text-xs text-ink shadow-xs">
      <div className="p-1.5 bg-warn-soft text-warn rounded-xl mt-0.5 shrink-0">
        <Info className="w-4 h-4" />
      </div>
      <div className="space-y-0.5">
        <p className="font-bold text-ink">
          طبيعة هذا التقرير: تقرير التدفقات والمتحصلات المحصلة خلال الفترة المحددة
        </p>
        <p className="text-muted leading-relaxed text-[11px]">
          يوضح هذا التقرير صافي الإيرادات والمبيعات المقبوضة مطروحاً منها المصروفات بحسب قناة الدفع
          (كاش، فيزا، إنستاباي، فودافون كاش، تحويل). أما{' '}
          <strong className="text-ink">الأرصدة اللحظية الفعلية للخزائن النقدية والحسابات البنكية والمحافظ</strong>،
          فتتابعها وتديرها بدقة لحظة بلحظة من شاشة{' '}
          <span className="font-bold text-ink underline">إدارة الخزن والحسابات</span>.
        </p>
      </div>
    </div>
  );
};
