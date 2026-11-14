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
import { Badge, Button, Card, DataTable, EmptyState, Input } from '../../ui';

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
    <Card className="p-0 sm:p-0 overflow-hidden transition-all">
      {/* Table Section Header / Banner */}
      <div className="p-4 sm:p-5 border-b border-line bg-surface-2/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-brand-soft text-brand rounded-xl">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-ink">
                سجل العمليات والحركات التفصيلية ({treasuryName})
              </h4>
              {meta && isTableOpen && (
                <Badge tone="neutral" className="tabular-nums text-[11px]">
                  {meta.total} حركة
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted">
              الحركات المالية الفردية المحصلة والمنصرفة عبر هذه الخزينة خلال الفترة
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Active Drill-down Chip */}
          {movementCategory && isTableOpen && (
            <Badge tone="warn" className="gap-1.5 rounded-xl px-2.5 py-1 text-[11px]">
              <span>تصفية: {getCategoryTitle(movementCategory)}</span>
              <button
                type="button"
                onClick={onClearDrillDown}
                className="min-h-[44px] min-w-[44px] -my-2 -ml-1.5 inline-flex items-center justify-center hover:bg-warn/20 rounded-full transition-colors cursor-pointer"
                title="إلغاء التصفية وعرض كل الحركات"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </Badge>
          )}

          {/* Quick Flow Filter Tabs (Only shown when table is open) */}
          {isTableOpen && (
            <div className="flex items-center bg-surface-2 border border-line p-1 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => onFlowFilterChange('ALL')}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  flowFilter === 'ALL' && !movementCategory
                    ? 'bg-panel text-ink shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => onFlowFilterChange('INFLOW')}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  flowFilter === 'INFLOW' && !movementCategory
                    ? 'bg-ok text-on-brand shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                الوارد (+)
              </button>
              <button
                type="button"
                onClick={() => onFlowFilterChange('OUTFLOW')}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  flowFilter === 'OUTFLOW' && !movementCategory
                    ? 'bg-bad text-on-brand shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                الصادر (-)
              </button>
            </div>
          )}

          {/* Print Filtered Transactions Button */}
          {onPrint && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onPrint}
              disabled={isPrinting}
              isLoading={isPrinting}
              leftIcon={!isPrinting ? <Printer className="w-3.5 h-3.5 text-muted" /> : undefined}
              className="text-xs font-bold"
              title="طباعة سجل الحركات كشف حساب رسمي للفترة المحددة"
            >
              طباعة السجل
            </Button>
          )}

          {/* Toggle Table Collapse Button */}
          <Button
            type="button"
            variant={isTableOpen ? 'secondary' : 'primary'}
            size="md"
            onClick={onToggleTable}
            rightIcon={
              isTableOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
            }
            className="text-xs font-bold"
          >
            {isTableOpen ? 'طي السجل' : 'عرض سجل العمليات التفصيلية'}
          </Button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isTableOpen ? (
        <div className="space-y-3">
          {/* Search Bar & Stats */}
          <div className="p-3 bg-surface-2/50 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="ابحث برقم المرجع، العميل، البيان..."
                leftIcon={<Search className="w-4 h-4" />}
                className="text-xs"
              />
              {localSearch && (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setLocalSearch('');
                    onSearchChange('');
                  }}
                  className="text-muted hover:text-ink px-2.5 shrink-0"
                  aria-label="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {meta && (
              <p className="text-[11px] text-muted font-medium">
                إجمالي العمليات المطابقة:{' '}
                <span className="font-bold tabular-nums text-ink">{meta.total}</span>
              </p>
            )}
          </div>

          {/* Table Content */}
          {isLoading ? (
            <div className="p-10 text-center space-y-3">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-brand border-t-transparent" />
              <p className="text-xs text-muted">جاري تحميل حركات {treasuryName}...</p>
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="لا توجد حركات مسجلة"
              description="لم يتم تسجيل أي عمليات بهذه الخزينة تطابق معايير البحث المحددة."
              action={
                (movementCategory || search) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      onClearDrillDown();
                      setLocalSearch('');
                      onSearchChange('');
                    }}
                    className="text-xs font-bold text-brand"
                  >
                    إلغاء التصفية والبحث
                  </Button>
                )
              }
              className="border-0 rounded-none py-12"
            />
          ) : (
            <>
              <DataTable className="border-0 rounded-none shadow-none">
                <thead className="bg-surface-2 text-muted font-bold border-b border-line text-xs">
                  <tr>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">المرجع / الرقم</th>
                    <th className="py-3 px-4">نوع الحركة</th>
                    <th className="py-3 px-4">الطرف / المستفيد</th>
                    <th className="py-3 px-4">المسؤول</th>
                    <th className="py-3 px-4">البيان / ملاحظات</th>
                    <th className="py-3 px-4 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {transactions.map((tx, idx) => {
                    const isInflow = tx.flow_direction === 'IN';
                    return (
                      <tr
                        key={`${tx.source_type}-${tx.id}-${idx}`}
                        className="hover:bg-surface-2/70 transition-colors"
                      >
                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-ink font-medium tabular-nums text-[11px]">
                            <Clock className="w-3 h-3 text-muted shrink-0" />
                            <span>{tx.date || '—'}</span>
                          </div>
                        </td>

                        {/* Reference */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge tone="neutral" className="tabular-nums font-bold text-ink text-[11px]">
                            {tx.reference_number || `#${tx.id}`}
                          </Badge>
                        </td>

                        {/* Category Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge tone={isInflow ? 'ok' : 'bad'} className="text-[11px]">
                            {isInflow ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            <span>{tx.category_label}</span>
                          </Badge>
                        </td>

                        {/* Party Name */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-ink">{tx.party_name || '—'}</span>
                        </td>

                        {/* Creator */}
                        <td className="py-3 px-4 whitespace-nowrap text-muted text-[11px]">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-muted shrink-0" />
                            <span>{tx.creator_name || '—'}</span>
                          </div>
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-4 max-w-xs truncate text-muted text-[11px]">
                          {tx.notes || '—'}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 whitespace-nowrap text-left tabular-nums font-black text-sm">
                          <span className={isInflow ? 'text-ok' : 'text-bad'}>
                            {isInflow ? '+' : '-'} {formatCurrency(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>

              {/* Pagination Controls */}
              {meta && meta.last_page > 1 && (
                <div className="p-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-surface-2/50">
                  <p className="text-muted font-medium">
                    عرض{' '}
                    <span className="font-bold tabular-nums text-ink">
                      {(meta.current_page - 1) * meta.per_page + 1}
                    </span>{' '}
                    إلى{' '}
                    <span className="font-bold tabular-nums text-ink">
                      {Math.min(meta.current_page * meta.per_page, meta.total)}
                    </span>{' '}
                    من إجمالي{' '}
                    <span className="font-bold tabular-nums text-ink">{meta.total}</span> حركة
                  </p>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => onPageChange(Math.max(1, page - 1))}
                      disabled={meta.current_page <= 1}
                      leftIcon={<ChevronRight className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                    >
                      السابق
                    </Button>

                    <Badge tone="neutral" className="px-3 py-1.5 font-bold tabular-nums text-[11px]">
                      {meta.current_page} / {meta.last_page}
                    </Badge>

                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => onPageChange(Math.min(meta.last_page, page + 1))}
                      disabled={meta.current_page >= meta.last_page}
                      rightIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
};
