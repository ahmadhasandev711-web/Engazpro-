import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
} from 'lucide-react';
import { formatCurrency, CashFlowTransaction } from '@pos-mandob/shared';

interface CashFlowTransactionsTableProps {
  treasuryName: string;
  isTableOpen: boolean;
  onToggleTable: () => void;
  transactions: CashFlowTransaction[];
  isLoading: boolean;
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  flowFilter: 'ALL' | 'INFLOW' | 'OUTFLOW';
  onFlowFilterChange: (flow: 'ALL' | 'INFLOW' | 'OUTFLOW') => void;
  movementCategory?: string;
  onClearDrillDown: () => void;
  search: string;
  onSearchChange: (val: string) => void;
  page: number;
  onPageChange: (newPage: number) => void;
  onPrint?: () => void;
  isPrinting?: boolean;
}

export const CashFlowTransactionsTable: React.FC<CashFlowTransactionsTableProps> = ({
  treasuryName,
  isTableOpen,
  onToggleTable,
  transactions,
  isLoading,
  meta,
  flowFilter,
  onFlowFilterChange,
  movementCategory,
  onClearDrillDown,
  search,
  onSearchChange,
  page,
  onPageChange,
  onPrint,
  isPrinting = false,
}) => {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounced search input
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange]);

  // Sync external search reset
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const getCategoryTitle = (cat: string) => {
    switch (cat) {
      case 'SALE':
        return 'مبيعات محصلة';
      case 'RECEIPT_VOUCHER':
        return 'سندات قبض';
      case 'PURCHASE_RETURN':
        return 'مرتجعات شراء مستردة';
      case 'PURCHASE':
        return 'مشتريات مدفوعة';
      case 'PAYMENT_VOUCHER':
        return 'سندات صرف';
      case 'SALE_RETURN':
        return 'مرتجعات بيع مردودة';
      case 'EXPENSE':
        return 'مصروفات نقدية';
      default:
        return cat;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Table Section Header / Banner */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary-50 text-primary-700 rounded-xl">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-900">
                سجل العمليات والحركات التفصيلية ({treasuryName})
              </h4>
              {meta && isTableOpen && (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                  {meta.total} حركة
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              الحركات المالية الفردية المحصلة والمنصرفة عبر هذه الخزينة خلال الفترة
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Active Drill-down Chip */}
          {movementCategory && isTableOpen && (
            <div className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl">
              <span>تصفية: {getCategoryTitle(movementCategory)}</span>
              <button
                type="button"
                onClick={onClearDrillDown}
                className="hover:bg-amber-200/60 p-0.5 rounded-full transition-colors"
                title="إلغاء التصفية وعرض كل الحركات"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Flow Filter Tabs (Only shown when table is open) */}
          {isTableOpen && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => onFlowFilterChange('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  flowFilter === 'ALL' && !movementCategory
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => onFlowFilterChange('INFLOW')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  flowFilter === 'INFLOW' && !movementCategory
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الوارد (+)
              </button>
              <button
                type="button"
                onClick={() => onFlowFilterChange('OUTFLOW')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  flowFilter === 'OUTFLOW' && !movementCategory
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الصادر (-)
              </button>
            </div>
          )}

          {/* Print Filtered Transactions Button */}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-xs active:scale-95 disabled:opacity-50"
              title="طباعة سجل الحركات كشف حساب رسمي للفترة المحددة"
            >
              {isPrinting ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-600 border-t-transparent" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>طباعة السجل</span>
            </button>
          )}

          {/* Toggle Table Collapse Button */}
          <button
            type="button"
            onClick={onToggleTable}
            className={`inline-flex items-center gap-1 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-xs ${
              isTableOpen
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            {isTableOpen ? (
              <>
                <span>طي السجل</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>عرض سجل العمليات التفصيلية</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isTableOpen ? (
        <div className="space-y-3">
          {/* Search Bar & Stats */}
          <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="ابحث برقم المرجع، العميل، البيان..."
                className="w-full pl-8 pr-9 py-1.5 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-sans"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearch('');
                    onSearchChange('');
                  }}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {meta && (
              <p className="text-[11px] text-slate-500 font-medium">
                إجمالي العمليات المطابقة:{' '}
                <span className="font-bold font-mono text-slate-900">{meta.total}</span>
              </p>
            )}
          </div>

          {/* Table Content */}
          {isLoading ? (
            <div className="p-10 text-center space-y-3">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
              <p className="text-xs text-slate-400">جاري تحميل حركات {treasuryName}...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-300 mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-600">لا توجد حركات مسجلة</p>
              <p className="text-[11px] text-slate-400">
                لم يتم تسجيل أي عمليات بهذه الخزينة تطابق معايير البحث المحددة.
              </p>
              {(movementCategory || search) && (
                <button
                  type="button"
                  onClick={() => {
                    onClearDrillDown();
                    setLocalSearch('');
                    onSearchChange('');
                  }}
                  className="mt-2 text-xs font-bold text-primary-600 hover:text-primary-700 underline"
                >
                  إلغاء التصفية والبحث
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="py-3 px-4">التاريخ والوقت</th>
                      <th className="py-3 px-4">المرجع / الرقم</th>
                      <th className="py-3 px-4">نوع الحركة</th>
                      <th className="py-3 px-4">الطرف / المستفيد</th>
                      <th className="py-3 px-4">المسؤول</th>
                      <th className="py-3 px-4">البيان / ملاحظات</th>
                      <th className="py-3 px-4 text-left">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx, idx) => {
                      const isInflow = tx.flow_direction === 'IN';
                      return (
                        <tr
                          key={`${tx.source_type}-${tx.id}-${idx}`}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Date */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{tx.date || '—'}</span>
                            </div>
                          </td>

                          {/* Reference */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              {tx.reference_number || `#${tx.id}`}
                            </span>
                          </td>

                          {/* Category Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                isInflow
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                              }`}
                            >
                              {isInflow ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                              <span>{tx.category_label}</span>
                            </span>
                          </td>

                          {/* Party Name */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800">
                              {tx.party_name || '—'}
                            </span>
                          </td>

                          {/* Creator */}
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{tx.creator_name || '—'}</span>
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="py-3 px-4 max-w-xs truncate text-slate-500 text-[11px]">
                            {tx.notes || '—'}
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 whitespace-nowrap text-left font-mono font-black text-sm">
                            <span className={isInflow ? 'text-emerald-700' : 'text-rose-700'}>
                              {isInflow ? '+' : '-'} {formatCurrency(tx.amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {meta && meta.last_page > 1 && (
                <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50">
                  <p className="text-slate-500 font-medium">
                    عرض{' '}
                    <span className="font-bold font-mono text-slate-800">
                      {(meta.current_page - 1) * meta.per_page + 1}
                    </span>{' '}
                    إلى{' '}
                    <span className="font-bold font-mono text-slate-800">
                      {Math.min(meta.current_page * meta.per_page, meta.total)}
                    </span>{' '}
                    من إجمالي{' '}
                    <span className="font-bold font-mono text-slate-800">
                      {meta.total}
                    </span>{' '}
                    حركة
                  </p>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPageChange(Math.max(1, page - 1))}
                      disabled={meta.current_page <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>السابق</span>
                    </button>

                    <span className="px-3 py-1.5 bg-slate-200/80 rounded-xl font-bold font-mono text-slate-800 text-[11px]">
                      {meta.current_page} / {meta.last_page}
                    </span>

                    <button
                      type="button"
                      onClick={() => onPageChange(Math.min(meta.last_page, page + 1))}
                      disabled={meta.current_page >= meta.last_page}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
                    >
                      <span>التالي</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
