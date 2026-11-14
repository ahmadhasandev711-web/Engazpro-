import React from 'react';
import { Package, Search, X, RefreshCw, Download, Printer } from 'lucide-react';
import { formatCurrency, StockTransferStatus, WcOrderStatus } from '@pos-mandob/shared';
import { Badge, Button, Input } from '../ui';
import { PaginationBar } from '../common/PaginationBar';

export type ManifestPaymentFilter = 'ALL' | 'COD' | 'PREPAID';
export type ManifestSourceFilter = 'ALL' | 'WOOCOMMERCE' | 'DIRECT_SALE';

export interface CourierManifestMetrics {
  total_shipments: number;
  in_transit_count: number;
  delivered_count: number;
  returned_count?: number;
  total_cod_amount: number;
  total_shipping_fees: number;
  collected_cod_amount?: number;
  pending_cod_amount: number;
}

export interface CourierManifestModalProps {
  courier: { id: number; name: string; phone?: string | null };
  shipments: any[];
  metrics: CourierManifestMetrics;
  pagination?: {
    current_page?: number;
    last_page?: number;
    total?: number;
    per_page?: number;
  };
  isLoading: boolean;
  isFetching: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  paymentFilter: ManifestPaymentFilter;
  onPaymentFilterChange: (value: ManifestPaymentFilter) => void;
  sourceFilter: ManifestSourceFilter;
  onSourceFilterChange: (value: ManifestSourceFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onClose: () => void;
}

const STATUS_TABS = [
  { key: 'ALL', label: 'الكل' },
  { key: StockTransferStatus.IN_TRANSIT, label: 'قيد التوصيل' },
  { key: WcOrderStatus.DELIVERED, label: 'تم التسليم' },
  { key: WcOrderStatus.RETURNED, label: 'مرتجع' },
];

const PAYMENT_TABS: { key: ManifestPaymentFilter; label: string }[] = [
  { key: 'ALL', label: 'الكل' },
  { key: 'COD', label: 'دفع عند الاستلام (COD)' },
  { key: 'PREPAID', label: 'مدفوع مسبقاً (أونلاين)' },
];

const SOURCE_TABS: { key: ManifestSourceFilter; label: string }[] = [
  { key: 'ALL', label: 'الكل' },
  { key: 'WOOCOMMERCE', label: 'ووكومرس' },
  { key: 'DIRECT_SALE', label: 'مباشر (POS)' },
];

export const CourierManifestModal: React.FC<CourierManifestModalProps> = ({
  courier,
  shipments,
  metrics,
  pagination,
  isLoading,
  isFetching,
  statusFilter,
  onStatusFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  sourceFilter,
  onSourceFilterChange,
  search,
  onSearchChange,
  page,
  onPageChange,
  onExportExcel,
  onPrint,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 print:hidden">
      <div className="bg-panel rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-line flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-surface-2 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-soft text-brand rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-ink">
                كشف شحنات وبوالص: {courier.name}
              </h3>
              <p className="text-xs text-muted">
                متابعة كافة فواتير وأوردرات المتجر المسندة لشركة الشحن ومطابقة التحصيلات
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 bg-canvas/60 border-b border-line text-center">
          <div className="p-2 bg-panel rounded-xl border border-line">
            <span className="text-2xs text-muted font-bold block">إجمالي الشحنات</span>
            <span className="text-sm font-black text-ink tabular-nums">{metrics.total_shipments}</span>
          </div>
          <div className="p-2 bg-panel rounded-xl border border-line">
            <span className="text-2xs text-warn font-bold block">قيد التوصيل (عهدة)</span>
            <span className="text-sm font-black text-warn tabular-nums">{metrics.in_transit_count}</span>
          </div>
          <div className="p-2 bg-panel rounded-xl border border-line">
            <span className="text-2xs text-ok font-bold block">تم التسليم</span>
            <span className="text-sm font-black text-ok tabular-nums">{metrics.delivered_count}</span>
          </div>
          <div className="p-2 bg-panel rounded-xl border border-line">
            <span className="text-2xs text-brand font-bold block">مطلوب COD</span>
            <span className="text-sm font-black text-brand tabular-nums">
              {formatCurrency(metrics.total_cod_amount)}
            </span>
          </div>
          <div className="p-2 bg-panel rounded-xl border border-line">
            <span className="text-2xs text-info font-bold block">أتعاب الشحن</span>
            <span className="text-sm font-black text-info tabular-nums">
              {formatCurrency(metrics.total_shipping_fees)}
            </span>
          </div>
          <div className="p-2 bg-panel rounded-xl border border-line">
            <span className="text-2xs text-ok font-bold block">تحصيل معلق</span>
            <span className="text-sm font-black text-ok tabular-nums">
              {formatCurrency(metrics.pending_cod_amount)}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 border-b border-line space-y-2.5 bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <span className="text-xs font-bold text-muted ml-1">الحالة:</span>
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onStatusFilterChange(tab.key)}
                  className={`min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    statusFilter === tab.key
                      ? 'bg-brand text-on-brand shadow-2xs'
                      : 'bg-surface-2 text-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <span className="text-xs font-bold text-muted ml-1">الدفع:</span>
              {PAYMENT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onPaymentFilterChange(tab.key)}
                  className={`min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    paymentFilter === tab.key
                      ? 'bg-ink text-panel shadow-2xs'
                      : 'bg-surface-2 text-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-muted ml-1">المصدر:</span>
              {SOURCE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onSourceFilterChange(tab.key)}
                  className={`min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    sourceFilter === tab.key
                      ? 'bg-ink text-panel shadow-2xs'
                      : 'bg-surface-2 text-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <Input
            type="text"
            placeholder="بحث سريع برقم الطلب، اسم العميل، رقم الهاتف، أو رقم البوليصة..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Shipments Table */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted font-bold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand" />
              <span>جاري تحميل كشف البوالص...</span>
            </div>
          ) : shipments.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted font-bold">
              لا توجد شحنات مطابقة للبحث أو الفلتر
            </div>
          ) : (
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-surface-2 text-muted text-xs font-black border-b border-line">
                  <th className="py-2.5 px-3 text-center w-8">م</th>
                  <th className="py-2.5 px-3">رقم الطلب / المصدر</th>
                  <th className="py-2.5 px-3">العميل والتوصيل</th>
                  <th className="py-2.5 px-3">البوليصة</th>
                  <th className="py-2.5 px-3 text-center">نوع التحصيل ومبلغ COD</th>
                  <th className="py-2.5 px-3 text-center">أجرة الشحن</th>
                  <th className="py-2.5 px-3 text-center">إجمالي الطلب</th>
                  <th className="py-2.5 px-3 text-center">حالة الشحنة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shipments.map((s: any, idx: number) => (
                  <tr key={s.id + s.source} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold tabular-nums text-muted">
                      {idx + 1}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-bold tabular-nums text-brand block">{s.reference}</span>
                      <Badge tone="neutral" className="mt-0.5 text-2xs px-1.5 py-0">
                        {s.source === 'WOOCOMMERCE' ? 'ووكومرس' : 'فاتورة مباشرة'}
                      </Badge>
                      {s.shipped_at && (
                        <span className="block text-2xs text-muted tabular-nums mt-0.5">{s.shipped_at}</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-bold text-ink block">{s.customer_name}</span>
                      {s.customer_phone && (
                        <span className="text-xs tabular-nums text-muted block" dir="ltr">
                          {s.customer_phone}
                        </span>
                      )}
                      {s.customer_address && (
                        <span className="text-2xs text-muted block truncate max-w-xs">
                          {s.city ? `${s.city} - ` : ''}
                          {s.customer_address}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 tabular-nums text-muted">
                      {s.tracking_number ? (
                        <Badge tone="brand" className="rounded text-xs px-1.5 py-0.5">
                          {s.tracking_number}
                        </Badge>
                      ) : (
                        <span className="text-muted text-2xs">بدون بوليصة</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {s.is_paid_online ? (
                        <Badge tone="ok" className="rounded text-2xs">
                          مدفوع مسبقاً (تحصيل: 0 ج.م)
                        </Badge>
                      ) : (
                        <div>
                          <span className="tabular-nums font-black text-ink text-sm block">
                            {formatCurrency(s.cod_amount ?? s.total)}
                          </span>
                          <Badge tone="warn" className="rounded text-2xs mt-0.5">
                            دفع عند الاستلام (COD)
                          </Badge>
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center tabular-nums font-bold text-info">
                      {formatCurrency(s.shipping_cost || 0)}
                    </td>

                    <td className="py-2.5 px-3 text-center tabular-nums font-bold text-ink">
                      {formatCurrency(s.total)}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        tone={
                          s.status === WcOrderStatus.DELIVERED
                            ? 'ok'
                            : s.status === WcOrderStatus.RETURNED
                            ? 'bad'
                            : 'warn'
                        }
                        className="rounded text-2xs"
                      >
                        {s.status_label}
                      </Badge>
                      <span className="block text-2xs text-muted mt-0.5 font-medium">
                        {s.payment_status_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <PaginationBar
            currentPage={pagination?.current_page || page}
            lastPage={pagination?.last_page || 1}
            total={pagination?.total || shipments.length}
            perPage={pagination?.per_page || 50}
            onPageChange={onPageChange}
            isFetching={isFetching}
            itemLabel="شحنة"
          />
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-surface-2/60 border-t border-line flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={shipments.length === 0}
              onClick={onExportExcel}
              leftIcon={<Download className="w-4 h-4 text-ok" />}
              title="تصدير الشحنات إلى ملف Excel"
            >
              تصدير Excel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onPrint}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              طباعة كشف A4 رسمي
            </Button>
          </div>

          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};
