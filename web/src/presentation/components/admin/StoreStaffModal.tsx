import React from 'react';
import { X, Users, GitBranch, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useStoreStaff } from '../../../hooks/useAdmin';
import { formatDate } from '@pos-mandob/shared';

interface StoreStaffModalProps {
  userId: number | null;
  onClose: () => void;
}

export const StoreStaffModal: React.FC<StoreStaffModalProps> = ({ userId, onClose }) => {
  const { data, isLoading } = useStoreStaff(userId);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <span>فريق العمل وفروع المتجر</span>
                {data?.owner?.business_name && (
                  <span className="text-xs bg-emerald-600/50 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {data.owner.business_name}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                المالك: <strong className="text-white">{data?.owner?.name}</strong> ({data?.owner?.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
              <p className="text-sm font-medium">جاري فحص الفروع والموظفين التابعين للمتجر...</p>
            </div>
          ) : (
            <>
              {/* Branches Section */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-emerald-600" />
                  <span>فروع المتجر ({data?.branches?.length || 0})</span>
                </h4>
                {(!data?.branches || data.branches.length === 0) ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                    لا توجد فروع مسجلة لهذا المتجر حتى الآن (يعمل بالفرع الافتراضي)
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.branches.map((b) => (
                      <div key={b.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{b.name}</span>
                            {b.is_main && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                                فرع رئيسي
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                            <span className="font-mono">كود: {b.code}</span>
                            {b.phone && <span>📞 {b.phone}</span>}
                          </div>
                        </div>
                        <div className="text-left">
                          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-bold">
                            {b.users_count ?? 0} موظف
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Employees Section */}
              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>طاقم العمل والمناديب ({data?.employees?.length || 0})</span>
                </h4>
                {(!data?.employees || data.employees.length === 0) ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                    لا يوجد موظفين أو مناديب تابعين لهذا الحساب (التاجر يعمل منفرداً)
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">الموظف</th>
                          <th className="px-4 py-3">الدور والوظيفة</th>
                          <th className="px-4 py-3">الفرع المخصص</th>
                          <th className="px-4 py-3">رقم الهاتف</th>
                          <th className="px-4 py-3">الحالة</th>
                          <th className="px-4 py-3">تاريخ الإضافة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.employees.map((emp) => {
                          const isActive = emp.status === 'ACTIVE' || !emp.status;
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-bold text-slate-900">
                                {emp.name}
                              </td>
                              <td className="px-4 py-3">
                                <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200">
                                  {emp.role === 'MANDOB' ? '🚗 مندوب شحن' : emp.role === 'CASHIER' ? '💵 كاشير' : emp.role === 'MANAGER' ? '👔 مدير فرع' : emp.role || 'موظف'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-600">
                                {emp.branch?.name || 'الكل / غير محدد'}
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                                {emp.phone}
                              </td>
                              <td className="px-4 py-3">
                                {isActive ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    نشط
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                                    <XCircle className="w-3.5 h-3.5" />
                                    موقوف
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-400">
                                {formatDate(emp.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
