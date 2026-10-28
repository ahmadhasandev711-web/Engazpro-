import React from 'react';
import { DateRangeFilter } from '../common/DateRangeFilter';
import { formatCurrency } from '@pos-mandob/shared';
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TreasuriesViewModel } from './types';

export const TreasuriesShiftsTab: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { activeTab, setSelectedPrintShift, shiftDateFrom, shiftDateTo, setShiftPage, handleShiftDateChange, isAllShiftsLoading, allShifts, currentShiftPage, lastShiftPage, totalShiftsCount } = vm;

  return (
    <>
      {/* Tab 3: Shifts History */}
      {activeTab === 'ALL_SHIFTS' && (
        <div className="space-y-4">
          {/* Filter Bar with DateRangeFilter defaulting to Today */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DateRangeFilter
                fromDate={shiftDateFrom}
                toDate={shiftDateTo}
                defaultPreset="today"
                onChange={handleShiftDateChange}
              />
            </div>

            <div className="text-xs text-slate-500 font-bold shrink-0 flex items-center gap-1.5 self-end md:self-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <span>إجمالي الورديات:</span>
              <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                {totalShiftsCount}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">رقم الوردية</th>
                  <th className="py-3 px-4">الموظف / الدور</th>
                  <th className="py-3 px-4">وقت الفتح</th>
                  <th className="py-3 px-4">وقت التقفيل</th>
                  <th className="py-3 px-4">مبيعات كاش</th>
                  <th className="py-3 px-4">المتوقع</th>
                  <th className="py-3 px-4">الفعلي المستلم</th>
                  <th className="py-3 px-4">الفرق</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">المعتمد</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isAllShiftsLoading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      جاري تحميل سجل الورديات...
                    </td>
                  </tr>
                ) : allShifts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      لا يوجد أي ورديات مسجلة بعد.
                    </td>
                  </tr>
                ) : (
                  allShifts.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.shift_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{s.user?.name || s.created_by_name || '-'}</div>
                        <div className="text-[10px] text-slate-400">
                          {(() => {
                            const role = s.user?.role || s.created_by_role;
                            if (role === 'MANDOB') return 'مندوب مبيعات';
                            if (role === 'SUPERVISOR') return 'مشرف ورديات';
                            if (role === 'MANAGER') return 'مدير فرع';
                            if (role === 'OWNER') return 'صاحب المنشأة';
                            return 'كاشير POS';
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(s.opened_at).toLocaleDateString('ar-EG')} {new Date(s.opened_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {s.closed_at
                          ? `${new Date(s.closed_at).toLocaleDateString('ar-EG')} ${new Date(s.closed_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                        {formatCurrency(s.cash_sales)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {formatCurrency(s.expected_cash)}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        {s.actual_cash != null ? formatCurrency(s.actual_cash) : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {s.difference === 0 ? (
                          <span className="text-emerald-600">0.00</span>
                        ) : s.difference > 0 ? (
                          <span className="text-amber-600">+{formatCurrency(s.difference)}</span>
                        ) : (
                          <span className="text-rose-600">{formatCurrency(s.difference)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'SETTLED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'CLOSED'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.status === 'SETTLED'
                            ? 'تم التوريد'
                            : s.status === 'CLOSED'
                            ? 'معلق للاستلام'
                            : 'نشط حالياً'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.settled_by_user?.name || s.settled_by_name || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedPrintShift(s)}
                          className="p-1.5 text-slate-500 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="طباعة بون إغلاق الوردية (Z-Report)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Shift History Cards View */}
          <div className="md:hidden divide-y divide-slate-100">
            {isAllShiftsLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">جاري تحميل سجل الورديات...</div>
            ) : allShifts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">لا يوجد أي ورديات مسجلة بعد.</div>
            ) : (
              allShifts.map((s: any) => (
                <div key={s.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {s.shift_number}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">
                        {s.user?.name || s.created_by_name || '-'}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {(() => {
                          const role = s.user?.role || s.created_by_role;
                          if (role === 'MANDOB') return 'مندوب مبيعات';
                          if (role === 'SUPERVISOR') return 'مشرف ورديات';
                          if (role === 'MANAGER') return 'مدير فرع';
                          if (role === 'OWNER') return 'صاحب المنشأة';
                          return 'كاشير POS';
                        })()}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        s.status === 'SETTLED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'CLOSED'
                          ? 'bg-rose-100 text-rose-800 animate-pulse'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status === 'SETTLED'
                        ? 'تم التوريد'
                        : s.status === 'CLOSED'
                        ? 'معلق للاستلام'
                        : 'نشط حالياً'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>مبيعات كاش:</span>
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(s.cash_sales)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>المتوقع:</span>
                      <span className="font-mono font-bold text-slate-700">{formatCurrency(s.expected_cash)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-sans border-t border-slate-200/60 pt-1 font-bold">
                      <span>الفعلي المستلم:</span>
                      <span className="font-mono font-black">{s.actual_cash != null ? formatCurrency(s.actual_cash) : '-'}</span>
                    </div>
                    {s.difference !== 0 && (
                      <div className="flex justify-between font-sans border-t border-slate-200/60 pt-1 font-bold">
                        <span>الفرق / العجز:</span>
                        <span className={`font-mono ${s.difference > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {s.difference > 0 ? `+${formatCurrency(s.difference)}` : formatCurrency(s.difference)}
                        </span>
                      </div>
                    )}
                  </div>

                  {s.settled_by_user?.name && (
                    <p className="text-[11px] text-slate-400 pt-1">
                      المعتمد: {s.settled_by_user.name}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedPrintShift(s)}
                    className="w-full mt-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200/60"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>طباعة إيصال الوردية (Z-Report)</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {lastShiftPage > 1 && (
            <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-medium">
                الصفحة <strong className="font-mono text-slate-800">{currentShiftPage}</strong> من{' '}
                <strong className="font-mono text-slate-800">{lastShiftPage}</strong> (إجمالي {totalShiftsCount} وردية)
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentShiftPage <= 1 || isAllShiftsLoading}
                  onClick={() => setShiftPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center gap-1 transition-colors shadow-2xs"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابق</span>
                </button>

                <button
                  type="button"
                  disabled={currentShiftPage >= lastShiftPage || isAllShiftsLoading}
                  onClick={() => setShiftPage((p) => Math.min(lastShiftPage, p + 1))}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center gap-1 transition-colors shadow-2xs"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
};
