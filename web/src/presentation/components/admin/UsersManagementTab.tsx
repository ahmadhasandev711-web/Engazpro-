import React from 'react';
import { Search, RefreshCw, Clock, Users, Store, ShieldAlert, ShieldCheck, Key } from 'lucide-react';
import { formatDate, User } from '@pos-mandob/shared';
import clsx from 'clsx';

interface UsersManagementTabProps {
  users: User[];
  isLoading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onSelectUserForExtend: (user: User) => void;
  onSelectUserForResetPassword: (user: User) => void;
  onInspectStore: (userId: number) => void;
  onToggleStatus: (user: User) => void;
  isTogglingStatus?: boolean;
}

export const UsersManagementTab: React.FC<UsersManagementTabProps> = ({
  users,
  isLoading,
  search,
  onSearchChange,
  onSelectUserForExtend,
  onSelectUserForResetPassword,
  onInspectStore,
  onToggleStatus,
  isTogglingStatus = false,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو اسم المتجر أو رقم الهاتف أو البريد..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-transparent border-none text-xs w-full focus:outline-none text-slate-800 font-medium"
            />
          </div>
          <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            <span>إجمالي المتاجر المسجلة: <strong className="text-slate-900">{users.length}</strong></span>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">التاجر / المنشأة</th>
                <th className="px-6 py-4">رقم الهاتف</th>
                <th className="px-6 py-4 text-center">الفروع وطاقم العمل</th>
                <th className="px-6 py-4">حالة المتجر</th>
                <th className="px-6 py-4">الاشتراك والمتبقي</th>
                <th className="px-6 py-4">نشاط الحساب</th>
                <th className="px-6 py-4 text-center">إجراءات الإدارة والرقابة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    جاري تحميل قائمة المتاجر والمشتركين...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    لا توجد متاجر مطابقة لخيارات البحث
                  </td>
                </tr>
              ) : (
                users.map((usr: any) => {
                  const sub = usr.subscription;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const endDate = sub?.end_date ? new Date(sub.end_date) : null;
                  const diffTime = endDate ? endDate.getTime() - today.getTime() : 0;
                  const computedDaysLeft = endDate ? Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) : 0;
                  const daysLeft =
                    sub?.days_remaining !== undefined && sub.days_remaining > 0
                      ? sub.days_remaining
                      : computedDaysLeft;
                  const isSubActive =
                    sub?.status === 'ACTIVE' && (daysLeft > 0 || (endDate !== null && endDate >= today));

                  const isStoreActive = usr.status === 'ACTIVE' || usr.status?.value === 'ACTIVE' || !usr.status;
                  const isRootAdmin = usr.is_admin || usr.email === 'ahmadhasandev711@gmail.com';

                  return (
                    <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{usr.name}</span>
                          {usr.is_admin && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                              مدير عام
                            </span>
                          )}
                        </div>
                        {usr.business_name && usr.business_name !== usr.name && (
                          <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Store className="w-3 h-3" />
                            <span>{usr.business_name}</span>
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">{usr.email || 'بدون بريد'}</div>
                      </td>

                      <td className="px-6 py-4 font-mono font-semibold text-slate-700">
                        {usr.phone}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => onInspectStore(usr.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-slate-200 shadow-sm"
                          title="عرض تفاصيل الفروع والموظفين التابعين"
                        >
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          <span>{usr.branches_count ?? 0} فرع | {usr.employees_count ?? 0} موظف</span>
                        </button>
                      </td>

                      <td className="px-6 py-4">
                        {isStoreActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            نشط 🟢
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            مجمد 🚫
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          {isSubActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              ساري حتى {sub?.end_date ? formatDate(sub.end_date) : '-'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                              منتهي ({sub?.end_date ? formatDate(sub.end_date) : '-'})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold mt-0.5">
                          <span className={daysLeft > 30 ? 'text-emerald-600' : daysLeft > 0 ? 'text-amber-600' : 'text-rose-600'}>
                            {daysLeft > 0 ? `متبقي ${daysLeft} يوم` : 'منتهي الصلاحية'}
                          </span>
                          <span className="text-slate-400 text-[10px] mr-1.5">({sub?.plan || 'TRIAL'})</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        <div>🧾 {usr.invoices_count || 0} فاتورة</div>
                        <div>📦 {usr.products_count || 0} صنف</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onSelectUserForExtend(usr)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors flex items-center gap-1 border border-emerald-200"
                            title="تمديد الاشتراك السنوي"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>تمديد ⚡</span>
                          </button>

                          <button
                            onClick={() => onSelectUserForResetPassword(usr)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-colors flex items-center gap-1 border border-indigo-200"
                            title="تعيين كلمة مرور جديدة"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>باسوورد 🔑</span>
                          </button>

                          {!isRootAdmin && (
                            <button
                              onClick={() => {
                                const confirmMsg = isStoreActive
                                  ? `هل أنت متأكد من رغبتك في تجميد حساب المتجر (${usr.name})؟ سيتم منع المالك وجميع موظفيه ومناديبه فورياً من استخدام النظام!`
                                  : `هل ترغب في إعادة تنشيط حساب المتجر (${usr.name})؟`;
                                if (window.confirm(confirmMsg)) {
                                  onToggleStatus(usr);
                                }
                              }}
                              disabled={isTogglingStatus}
                              className={clsx(
                                'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border',
                                isStoreActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200'
                              )}
                              title={isStoreActive ? 'تجميد حساب المتجر كاملاً (Kill-Switch)' : 'إعادة تنشيط الحساب'}
                            >
                              {isStoreActive ? (
                                <>
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                  <span>تجميد 🚫</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                                  <span>تنشيط 🟢</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
