import React from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { AdminStatsData } from '@pos-mandob/shared';
import { Card } from '../ui';

interface SystemHealthTabProps {
  stats?: AdminStatsData;
}

export const SystemHealthTab: React.FC<SystemHealthTabProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
      <Card className="space-y-4">
        <h3 className="text-base font-black text-ink flex items-center gap-2">
          <Database className="w-5 h-5 text-brand" />
          <span>حالة قاعدة البيانات والسيرفر</span>
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
            <span className="text-muted font-medium">محرك قاعدة البيانات:</span>
            <strong className="text-ok font-mono font-bold">
              {stats?.system?.database_label || 'MYSQL (Secured)'}
            </strong>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
            <span className="text-muted font-medium">إجمالي الفواتير الصادرة:</span>
            <strong className="text-ink font-mono">{stats?.activity.invoices ?? 0} فاتورة</strong>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
            <span className="text-muted font-medium">إجمالي الأصناف بالمخازن:</span>
            <strong className="text-ink font-mono">{stats?.activity.products ?? 0} صنف</strong>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
            <span className="text-muted font-medium">إجمالي العملاء والموردين:</span>
            <strong className="text-ink font-mono">{stats?.activity.parties ?? 0} طرف</strong>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-base font-black text-ink flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-ok" />
          <span>إعدادات وتراخيص إنجاز برو</span>
        </h3>

        <div className="p-4 bg-ok-soft border border-ok/20 rounded-xl text-xs text-ink leading-relaxed space-y-2">
          <p className="font-black text-sm text-ok">حماية الأكواد وتقييد المحاولات</p>
          <p className="text-muted">
            يتم التحقق من الأكواد برمجياً داخل معاملة ذرية مع قفل الصفوف (Lock For Update) وحد محاولات صارم لمنع التخمين والتكرار.
          </p>
          <p className="text-muted">
            قنوات الدفع المعتمدة: <strong className="text-ink">فودافون كاش (01125030642)</strong> و{' '}
            <strong className="text-ink">إنستاباي (01125030642)</strong>.
          </p>
        </div>
      </Card>
    </div>
  );
};
