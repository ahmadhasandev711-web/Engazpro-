import React from 'react';
import { formatCurrency, UserRole } from '@pos-mandob/shared';
import { CheckCircle2, Clock, ShieldCheck, TrendingDown, TrendingUp, Printer } from 'lucide-react';
import type { TreasuriesViewModel } from './types';
import { Badge, Button, Card, EmptyState, Tabs } from '../ui';

export const TreasuriesPendingTab: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { canSettleShifts, activeTab, setActiveTab, setSelectedShiftToSettle, setSelectedPrintShift, isPendingLoading, pendingShifts, tabOptions } = vm;

  return (
    <>
      {/* Tabs Navigation (Horizontal Scroll Track) */}
      <div className="w-full min-w-0">
        <Tabs
          tabs={tabOptions.map((t) => ({ id: t.id, label: t.label, count: t.count }))}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as any)}
        />
      </div>

      {/* Tab 1: Pending Handover Settlements */}
      {activeTab === 'PENDING' && (
        <div className="space-y-4 flex-1">
          {isPendingLoading ? (
            <div className="p-12 text-center text-muted text-xs">جاري تحميل الورديات المعلقة...</div>
          ) : pendingShifts.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6 text-ok" />}
              title="لا توجد ورديات معلقة بانتظار التوريد"
              description="جميع الورديات التي تم تقفيلها تم توريدها واعتمادها في خزينة الفرع / الخزينة الرئيسية بنجاح."
              className="rounded-3xl"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pendingShifts.map((shift: any) => {
                const diff = shift.difference || 0;
                const isDiffZero = diff === 0;
                const isSurplus = diff > 0;

                return (
                  <Card
                    key={shift.id}
                    className="rounded-3xl p-5 flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-center justify-between pb-3 border-b border-line">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge tone="neutral" className="tabular-nums font-black text-xs rounded-xl px-2.5 py-1">
                            {shift.shift_number}
                          </Badge>
                          <span className="text-xs font-bold text-ink">
                            {shift.user?.name || shift.created_by_name || 'موظف'}
                          </span>
                          <Badge tone="brand" className="text-[10px]">
                            {(shift.user?.role || shift.created_by_role) === UserRole.MANDOB ? 'مندوب' : 'كاشير'}
                          </Badge>
                        </div>

                        <span className="text-[11px] text-muted flex items-center gap-1 tabular-nums">
                          <Clock className="w-3.5 h-3.5" />
                          {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString('ar-EG') : ''}
                        </span>
                      </div>

                      {/* Financial Breakdown Grid */}
                      <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                        <div className="p-2.5 bg-surface-2 rounded-xl border border-line/60">
                          <span className="text-muted text-[11px] block">رصيد الافتتاح:</span>
                          <span className="font-bold text-ink tabular-nums">
                            {formatCurrency(shift.opening_balance)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-surface-2 rounded-xl border border-line/60">
                          <span className="text-muted text-[11px] block">مبيعات كاش:</span>
                          <span className="font-bold text-ok tabular-nums">
                            +{formatCurrency(shift.cash_sales)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-surface-2 rounded-xl border border-line/60">
                          <span className="text-muted text-[11px] block">تحصيلات عملاء:</span>
                          <span className="font-bold text-ok tabular-nums">
                            +{formatCurrency(shift.cash_receipts)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-surface-2 rounded-xl border border-line/60">
                          <span className="text-muted text-[11px] block">مصروفات:</span>
                          <span className="font-bold text-bad tabular-nums">
                            -{formatCurrency(shift.expenses)}
                          </span>
                        </div>
                      </div>

                      {/* Expected vs Actual */}
                      <div className="p-3.5 bg-surface-2 border border-line rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">النقدية المتوقعة (النظام):</span>
                          <span className="tabular-nums font-bold text-ink">{formatCurrency(shift.expected_cash)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">المبلغ الفعلي المورد:</span>
                          <span className="tabular-nums font-black text-brand text-sm">
                            {formatCurrency(shift.actual_cash)}
                          </span>
                        </div>

                        {/* Difference Alert */}
                        <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                          <span className="text-[11px] text-muted">نتيجة المطابقة:</span>
                          {isDiffZero ? (
                            <span className="text-ok font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              مطابق تماماً (0.00)
                            </span>
                          ) : isSurplus ? (
                            <span className="text-warn font-bold flex items-center gap-1 text-[11px] tabular-nums">
                              <TrendingUp className="w-3.5 h-3.5" />
                              زيادة +{formatCurrency(diff)}
                            </span>
                          ) : (
                            <span className="text-bad font-bold flex items-center gap-1 text-[11px] tabular-nums">
                              <TrendingDown className="w-3.5 h-3.5" />
                              عجز {formatCurrency(diff)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes if any */}
                      {shift.notes && (
                        <div className="mt-3 p-2.5 bg-surface-2 border border-line rounded-xl text-[11px] text-muted">
                          <strong className="text-ink">ملاحظات الموظف:</strong> {shift.notes}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                      <Button
                        variant="secondary"
                        size="md"
                        leftIcon={<Printer className="w-4 h-4 text-muted" />}
                        onClick={() => setSelectedPrintShift(shift)}
                        className="px-3 text-xs font-bold shrink-0"
                        title="طباعة بون إغلاق الوردية (Z-Report)"
                      >
                        بون الوردية
                      </Button>

                      {canSettleShifts ? (
                        <Button
                          variant="primary"
                          size="md"
                          leftIcon={<ShieldCheck className="w-4 h-4" />}
                          onClick={() => setSelectedShiftToSettle(shift)}
                          className="flex-1 text-xs font-black tabular-nums"
                        >
                          تأكيد استلام ({formatCurrency(shift.actual_cash)})
                        </Button>
                      ) : (
                        <span className="text-xs text-muted italic">
                          يتطلب صلاحية المالك، المدير، أو المشرف لاعتماد الاستلام
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};
