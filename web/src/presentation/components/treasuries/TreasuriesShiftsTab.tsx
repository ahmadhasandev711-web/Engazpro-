import React from 'react';
import { DateRangeFilter } from '../common/DateRangeFilter';
import { formatCurrency } from '@pos-mandob/shared';
import { Printer, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { TreasuriesViewModel } from './types';
import { Badge, Button, Card, DataTable, EmptyState } from '../ui';

export const TreasuriesShiftsTab: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { activeTab, setSelectedPrintShift, shiftDateFrom, shiftDateTo, setShiftPage, handleShiftDateChange, isAllShiftsLoading, allShifts, currentShiftPage, lastShiftPage, totalShiftsCount } = vm;

  return (
    <>
      {/* Tab 3: Shifts History */}
      {activeTab === 'ALL_SHIFTS' && (
        <div className="space-y-4">
          {/* Filter Bar with DateRangeFilter defaulting to Today */}
          <Card className="rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DateRangeFilter
                fromDate={shiftDateFrom}
                toDate={shiftDateTo}
                defaultPreset="today"
                onChange={handleShiftDateChange}
              />
            </div>

            <div className="text-xs text-muted font-bold shrink-0 flex items-center gap-1.5 self-end md:self-center bg-surface-2 px-3 py-1.5 rounded-xl border border-line">
              <span>إجمالي الورديات:</span>
              <span className="tabular-nums font-black text-ink bg-panel px-2 py-0.5 rounded-lg border border-line">
                {totalShiftsCount}
              </span>
            </div>
          </Card>

          <Card className="rounded-3xl overflow-hidden p-0">
            {isAllShiftsLoading ? (
              <div className="p-10 text-center text-muted text-xs">جاري تحميل سجل الورديات...</div>
            ) : allShifts.length === 0 ? (
              <EmptyState
                icon={<Clock className="w-6 h-6" />}
                title="لا يوجد أي ورديات مسجلة بعد"
                className="border-0 rounded-none"
              />
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <DataTable tableClassName="text-xs" className="border-0 rounded-none shadow-none">
                    <thead className="bg-surface-2 border-b border-line text-muted font-bold">
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
                    <tbody className="divide-y divide-line">
                      {allShifts.map((s: any) => (
                        <tr key={s.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-3 px-4 tabular-nums font-bold text-ink">{s.shift_number}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-ink">{s.user?.name || s.created_by_name || '-'}</div>
                            <div className="text-[11px] text-muted">
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
                          <td className="py-3 px-4 tabular-nums text-muted">
                            {new Date(s.opened_at).toLocaleDateString('ar-EG')} {new Date(s.opened_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 tabular-nums text-muted">
                            {s.closed_at
                              ? `${new Date(s.closed_at).toLocaleDateString('ar-EG')} ${new Date(s.closed_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                              : '-'}
                          </td>
                          <td className="py-3 px-4 tabular-nums">
                            <div className="font-bold text-ok">{formatCurrency(s.cash_sales)}</div>
                            {Number(s.electronic_sales ?? 0) > 0 && (
                              <div className="text-[11px] font-bold text-brand">
                                شبكة/محافظ: +{formatCurrency(s.electronic_sales)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 tabular-nums text-ink">
                            {formatCurrency(s.expected_cash)}
                          </td>
                          <td className="py-3 px-4 tabular-nums font-black text-ink">
                            {s.actual_cash != null ? formatCurrency(s.actual_cash) : '-'}
                          </td>
                          <td className="py-3 px-4 tabular-nums font-bold">
                            {s.difference === 0 ? (
                              <span className="text-ok">0.00</span>
                            ) : s.difference > 0 ? (
                              <span className="text-warn">+{formatCurrency(s.difference)}</span>
                            ) : (
                              <span className="text-bad">{formatCurrency(s.difference)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              tone={
                                s.status === 'SETTLED'
                                  ? 'ok'
                                  : s.status === 'CLOSED'
                                  ? 'bad'
                                  : 'warn'
                              }
                              className="text-[10px]"
                            >
                              {s.status === 'SETTLED'
                                ? 'تم التوريد'
                                : s.status === 'CLOSED'
                                ? 'معلق للاستلام'
                                : 'نشط حالياً'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted">
                            {s.settled_by_user?.name || s.settled_by_name || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedPrintShift(s)}
                              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-brand rounded-xl hover:bg-surface-2 transition-colors"
                              title="طباعة بون إغلاق الوردية (Z-Report)"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>

                {/* Mobile Shift History Cards View */}
                <div className="md:hidden divide-y divide-line">
                  {allShifts.map((s: any) => (
                    <div key={s.id} className="p-4 space-y-3 bg-panel">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge tone="neutral" className="tabular-nums font-bold text-xs rounded-lg">
                            {s.shift_number}
                          </Badge>
                          <h4 className="font-bold text-ink text-sm mt-1">
                            {s.user?.name || s.created_by_name || '-'}
                          </h4>
                          <span className="text-[11px] text-muted">
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

                        <Badge
                          tone={
                            s.status === 'SETTLED'
                              ? 'ok'
                              : s.status === 'CLOSED'
                              ? 'bad'
                              : 'warn'
                          }
                          className="text-[10px]"
                        >
                          {s.status === 'SETTLED'
                            ? 'تم التوريد'
                            : s.status === 'CLOSED'
                            ? 'معلق للاستلام'
                            : 'نشط حالياً'}
                        </Badge>
                      </div>

                      <div className="p-3 bg-surface-2 rounded-2xl border border-line text-xs space-y-1.5 tabular-nums">
                        <div className="flex justify-between text-muted">
                          <span>مبيعات كاش:</span>
                          <span className="font-bold text-ok">{formatCurrency(s.cash_sales)}</span>
                        </div>
                        {Number(s.electronic_sales ?? 0) > 0 && (
                          <div className="flex justify-between text-muted">
                            <span>شبكة / محافظ:</span>
                            <span className="font-bold text-brand">+{formatCurrency(s.electronic_sales)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-muted">
                          <span>المتوقع:</span>
                          <span className="font-bold text-ink">{formatCurrency(s.expected_cash)}</span>
                        </div>
                        <div className="flex justify-between text-ink border-t border-line pt-1 font-bold">
                          <span>الفعلي المستلم:</span>
                          <span className="font-black">{s.actual_cash != null ? formatCurrency(s.actual_cash) : '-'}</span>
                        </div>
                        {s.difference !== 0 && (
                          <div className="flex justify-between border-t border-line pt-1 font-bold">
                            <span>الفرق / العجز:</span>
                            <span className={s.difference > 0 ? 'text-warn' : 'text-bad'}>
                              {s.difference > 0 ? `+${formatCurrency(s.difference)}` : formatCurrency(s.difference)}
                            </span>
                          </div>
                        )}
                      </div>

                      {s.settled_by_user?.name && (
                        <p className="text-[11px] text-muted pt-1">
                          المعتمد: {s.settled_by_user.name}
                        </p>
                      )}

                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        leftIcon={<Printer className="w-3.5 h-3.5 text-muted" />}
                        onClick={() => setSelectedPrintShift(s)}
                        className="w-full mt-2 text-xs font-bold"
                      >
                        طباعة إيصال الوردية (Z-Report)
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination Controls */}
            {lastShiftPage > 1 && (
              <div className="p-4 bg-surface-2 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-muted font-medium">
                  الصفحة <strong className="tabular-nums text-ink">{currentShiftPage}</strong> من{' '}
                  <strong className="tabular-nums text-ink">{lastShiftPage}</strong> (إجمالي {totalShiftsCount} وردية)
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={currentShiftPage <= 1 || isAllShiftsLoading}
                    onClick={() => setShiftPage((p) => Math.max(1, p - 1))}
                    leftIcon={<ChevronRight className="w-4 h-4" />}
                    className="text-xs font-bold"
                  >
                    السابق
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={currentShiftPage >= lastShiftPage || isAllShiftsLoading}
                    onClick={() => setShiftPage((p) => Math.min(lastShiftPage, p + 1))}
                    rightIcon={<ChevronLeft className="w-4 h-4" />}
                    className="text-xs font-bold"
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
};
