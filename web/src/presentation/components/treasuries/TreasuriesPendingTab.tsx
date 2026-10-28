import React from 'react';
import { MobileFilterChips } from '../mobile/MobileFilterChips';
import { formatCurrency } from '@pos-mandob/shared';
import { CheckCircle2, Clock, ShieldCheck, TrendingDown, TrendingUp, Printer } from 'lucide-react';
import type { TreasuriesViewModel } from './types';

export const TreasuriesPendingTab: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { canSettleShifts, activeTab, setActiveTab, setSelectedShiftToSettle, setSelectedPrintShift, isPendingLoading, pendingShifts, tabOptions } = vm;

  return (
    <>
      {/* Tabs Navigation (Horizontal Scroll Track) */}
      <div className="w-full min-w-0">
        <MobileFilterChips
          options={tabOptions}
          selectedId={activeTab}
          onSelect={(tab) => setActiveTab(tab as any)}
        />
      </div>

      {/* Tab 1: Pending Handover Settlements */}
      {activeTab === 'PENDING' && (
        <div className="space-y-4 flex-1">
          {isPendingLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">جاري تحميل الورديات المعلقة...</div>
          ) : pendingShifts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">لا توجد ورديات معلقة بانتظار التوريد</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                جميع الورديات التي تم تقفيلها تم توريدها واعتمادها في خزينة الفرع / الخزينة الرئيسية بنجاح.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pendingShifts.map((shift: any) => {
                const diff = shift.difference || 0;
                const isDiffZero = diff === 0;
                const isSurplus = diff > 0;

                return (
                  <div
                    key={shift.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-xl">
                            {shift.shift_number}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {shift.user?.name || shift.created_by_name || 'موظف'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700">
                            {(shift.user?.role || shift.created_by_role) === 'MANDOB' ? 'مندوب' : 'كاشير'}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString('ar-EG') : ''}
                        </span>
                      </div>

                      {/* Financial Breakdown Grid */}
                      <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">رصيد الافتتاح:</span>
                          <span className="font-bold text-slate-700 font-mono">
                            {formatCurrency(shift.opening_balance)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">مبيعات كاش:</span>
                          <span className="font-bold text-emerald-600 font-mono">
                            +{formatCurrency(shift.cash_sales)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">تحصيلات عملاء:</span>
                          <span className="font-bold text-emerald-600 font-mono">
                            +{formatCurrency(shift.cash_receipts)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">مصروفات:</span>
                          <span className="font-bold text-rose-600 font-mono">
                            -{formatCurrency(shift.expenses)}
                          </span>
                        </div>
                      </div>

                      {/* Expected vs Actual */}
                      <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">النقدية المتوقعة (النظام):</span>
                          <span className="font-mono font-bold">{formatCurrency(shift.expected_cash)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">المبلغ الفعلي المورد:</span>
                          <span className="font-mono font-black text-amber-300 text-sm">
                            {formatCurrency(shift.actual_cash)}
                          </span>
                        </div>

                        {/* Difference Alert */}
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-400">نتيجة المطابقة:</span>
                          {isDiffZero ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              مطابق تماماً (0.00)
                            </span>
                          ) : isSurplus ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                              <TrendingUp className="w-3.5 h-3.5" />
                              زيادة +{formatCurrency(diff)}
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold flex items-center gap-1 text-[11px]">
                              <TrendingDown className="w-3.5 h-3.5" />
                              عجز {formatCurrency(diff)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes if any */}
                      {shift.notes && (
                        <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-600">
                          <strong className="text-slate-700">ملاحظات الموظف:</strong> {shift.notes}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedPrintShift(shift)}
                        className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                        title="طباعة بون إغلاق الوردية (Z-Report)"
                      >
                        <Printer className="w-4 h-4 text-slate-600" />
                        <span>بون الوردية</span>
                      </button>

                      {canSettleShifts ? (
                        <button
                          onClick={() => setSelectedShiftToSettle(shift)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1.5"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>تأكيد استلام ({formatCurrency(shift.actual_cash)})</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          يتطلب صلاحية المالك، المدير، أو المشرف لاعتماد الاستلام
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};
