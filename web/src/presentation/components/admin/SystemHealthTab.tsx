import React from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { AdminStatsData } from '@pos-mandob/shared';

interface SystemHealthTabProps {
  stats?: AdminStatsData;
}

export const SystemHealthTab: React.FC<SystemHealthTabProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600" />
          <span>حالة قاعدة البيانات والسيرفر</span>
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-600">محرك قاعدة البيانات الفعلي:</span>
            <strong className="text-emerald-700 font-mono font-bold">{stats?.system?.database_label || 'MYSQL (pos_mandob)'}</strong>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-600">إجمالي الفواتير الصادرة بالمنصة:</span>
            <strong className="text-slate-900">{stats?.activity.invoices ?? 0} فاتورة</strong>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-600">إجمالي الأصناف بالمخازن:</span>
            <strong className="text-slate-900">{stats?.activity.products ?? 0} صنف</strong>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-600">إجمالي العملاء والموردين:</span>
            <strong className="text-slate-900">{stats?.activity.parties ?? 0} طرف</strong>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>إعدادات وتراخيص إنجاز برو</span>
        </h3>
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed space-y-2">
          <p className="font-bold text-sm">🛡️ ميزة الحماية المشددة لأكواد التفعيل:</p>
          <p>
            يتم التحقق من الأكواد برمجياً بنظام Lock For Update، مما يضمن استحالة استخدام الكود الواحد أكثر من مرة حتى في حال التزامن اللحظي.
          </p>
          <p>
            قنوات الدفع المعروضة للعملاء: <strong>فودافون كاش (01125030642)</strong> و <strong>إنستاباي (01125030642)</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
