import React from 'react';
import { Store, Key, CreditCard, Layers } from 'lucide-react';
import { formatCurrency, AdminStatsData } from '@pos-mandob/shared';

interface AdminKPICardsProps {
  stats?: AdminStatsData;
}

export const AdminKPICards: React.FC<AdminKPICardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Total Merchants */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">المتاجر المشتركة</span>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-slate-900">{stats?.users.merchants ?? 0}</span>
          <span className="text-xs text-slate-500 font-medium">متجر / منشأة</span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span className="text-emerald-600 font-bold">🟢 {stats?.subscriptions.active ?? 0} نشط</span>
          <span className="text-rose-600 font-bold">🔴 {stats?.subscriptions.expired ?? 0} منتهي</span>
          <span className="text-blue-600 font-medium">👥 {stats?.users.staff ?? 0} موظف</span>
        </div>
      </div>

      {/* License Keys Bank */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">بنك أكواد التفعيل</span>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-emerald-700">{stats?.licenses.unused ?? 0}</span>
          <span className="text-xs text-slate-500 font-medium">كود متاح للبيع 🟢</span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>المستخدم: <strong className="text-slate-900">{stats?.licenses.used ?? 0}</strong></span>
          <span className="text-amber-700 font-bold">الملغي: {stats?.licenses.revoked ?? 0}</span>
          <span>الإجمالي: {stats?.licenses.total ?? 0}</span>
        </div>
      </div>

      {/* Estimated SaaS Revenue */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">الإيراد التقديري للاشتراكات</span>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-slate-900">{formatCurrency(stats?.financials.estimated_revenue_egp ?? 0)}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>إجمالي الاشتراكات المعتمدة</span>
          <span className="font-bold text-purple-600">فودافون / إنستا</span>
        </div>
      </div>

      {/* Platform Activity */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">نشاط المنصة الكلي</span>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-black text-slate-900">{stats?.activity.invoices ?? 0}</span>
          <span className="text-xs text-slate-500 font-medium">فاتورة صادرة</span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>{stats?.activity.products ?? 0} صنف بالمخازن</span>
          <span>{stats?.activity.parties ?? 0} عميل ومورد</span>
        </div>
      </div>
    </div>
  );
};
