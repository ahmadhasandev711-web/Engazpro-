import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Search, ShoppingBag } from 'lucide-react';
import {
  EasyfyOrderStatus,
  EasyfyPaymentMethod,
  EasyfyPaymentStatus,
  formatCurrency,
} from '@pos-mandob/shared';
import { useAdminEasyfyOrders } from '../../../../hooks/useAdminEasyfy';
import { Badge, Button, Card, DataTable, EmptyState, Input, Select } from '../../ui';
import { EasyfyOrderDetailDrawer } from './EasyfyOrderDetailDrawer';
import {
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_META,
} from './easyfyUiMeta';

export const AdminEasyfyOrdersTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<EasyfyOrderStatus | ''>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<EasyfyPaymentStatus | ''>('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<EasyfyPaymentMethod | ''>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data, isLoading } = useAdminEasyfyOrders({
    status: statusFilter,
    payment_verification_status: paymentStatusFilter,
    payment_method: paymentMethodFilter,
    search,
    page,
  });

  const orders = data?.items ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={paymentStatusFilter === EasyfyPaymentStatus.PENDING_REVIEW ? 'primary' : 'secondary'}
              onClick={() => {
                setPaymentStatusFilter((prev) =>
                  prev === EasyfyPaymentStatus.PENDING_REVIEW ? '' : EasyfyPaymentStatus.PENDING_REVIEW
                );
                setPage(1);
              }}
            >
              تحويلات بانتظار المراجعة
            </Button>
            <Button
              size="sm"
              variant={statusFilter === EasyfyOrderStatus.PENDING ? 'primary' : 'secondary'}
              onClick={() => {
                setStatusFilter((prev) =>
                  prev === EasyfyOrderStatus.PENDING ? '' : EasyfyOrderStatus.PENDING
                );
                setPage(1);
              }}
            >
              طلبات جديدة
            </Button>
          </div>
          <span className="text-xs font-bold text-muted">
            إجمالي المطابق: {data?.total ?? 0} طلب
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="بحث برقم الطلب، اسم المتجر، الهاتف..."
            leftIcon={<Search className="w-4 h-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as EasyfyOrderStatus | '');
              setPage(1);
            }}
            options={[
              { value: '', label: 'كل حالات الطلب' },
              { value: EasyfyOrderStatus.PENDING, label: 'قيد المراجعة' },
              { value: EasyfyOrderStatus.CONFIRMED, label: 'مؤكد' },
              { value: EasyfyOrderStatus.PREPARING, label: 'قيد التجهيز' },
              { value: EasyfyOrderStatus.SHIPPED, label: 'تم الشحن' },
              { value: EasyfyOrderStatus.DELIVERED, label: 'تم التسليم' },
              { value: EasyfyOrderStatus.CANCELLED, label: 'ملغي' },
            ]}
          />
          <Select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value as EasyfyPaymentStatus | '');
              setPage(1);
            }}
            options={[
              { value: '', label: 'كل حالات التحويل' },
              { value: EasyfyPaymentStatus.PENDING_REVIEW, label: 'بانتظار مراجعة التحويل' },
              { value: EasyfyPaymentStatus.VERIFIED, label: 'تحويل مؤكد' },
              { value: EasyfyPaymentStatus.REJECTED, label: 'تحويل مرفوض' },
              { value: EasyfyPaymentStatus.NOT_REQUIRED, label: 'دفع عند الاستلام' },
            ]}
          />
          <Select
            value={paymentMethodFilter}
            onChange={(e) => {
              setPaymentMethodFilter(e.target.value as EasyfyPaymentMethod | '');
              setPage(1);
            }}
            options={[
              { value: '', label: 'كل وسائل الدفع' },
              { value: EasyfyPaymentMethod.CASH_ON_DELIVERY, label: 'الدفع عند الاستلام' },
              { value: EasyfyPaymentMethod.INSTAPAY, label: 'إنستاباي' },
              { value: EasyfyPaymentMethod.VODAFONE_CASH, label: 'فودافون كاش' },
            ]}
          />
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-6">
          <div className="h-40 rounded-xl bg-surface-2 animate-pulse" />
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8 text-muted" />}
          title="لا توجد طلبات مطابقة للبحث"
          description="جرّب تغيير الفلاتر أو مسح حقل البحث لعرض طلبات المتجر."
        />
      ) : (
        <DataTable>
          <thead className="bg-surface-2 text-xs text-muted font-extrabold">
            <tr>
              <th className="px-4 py-3">رقم الطلب</th>
              <th className="px-4 py-3">المتجر والعميل</th>
              <th className="px-4 py-3">منفذ الطلب</th>
              <th className="px-4 py-3">الإجمالي والربح</th>
              <th className="px-4 py-3">الدفع والتحويل</th>
              <th className="px-4 py-3">حالة التنفيذ</th>
              <th className="px-4 py-3 text-left">إدارة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((order) => {
              const stMeta = ORDER_STATUS_META[order.status] ?? {
                label: String(order.status),
                tone: 'neutral' as const,
              };
              const payMeta = PAYMENT_STATUS_META[order.payment_verification_status] ?? {
                label: String(order.payment_verification_status),
                tone: 'neutral' as const,
              };
              return (
                <tr key={order.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-black text-brand-ink">{order.order_number}</p>
                    <p className="text-[11px] text-muted">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('ar-EG') : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-ink">{order.store_name || order.owner_name}</p>
                    <p className="text-[11px] text-muted">
                      {order.owner_phone} • {order.governorate}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-ink">{order.ordered_by_name || '-'}</p>
                    <p className="text-[11px] text-muted">
                      {order.ordered_by_role || '-'} • {order.ordered_by_phone || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-black text-ink tabular-nums">{formatCurrency(order.total_amount)}</p>
                    <p className="text-[11px] font-bold text-ok tabular-nums">
                      ربح: {formatCurrency(order.gross_profit ?? 0)}
                    </p>
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    <p className="text-xs font-bold text-ink">
                      {PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method}
                    </p>
                    <Badge tone={payMeta.tone}>{payMeta.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={stMeta.tone}>{stMeta.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      إدارة
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            leftIcon={<ChevronRight className="w-4 h-4" />}
          >
            السابق
          </Button>
          <span className="text-xs font-bold text-muted">
            صفحة {data.current_page} من {data.last_page}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => p + 1)}
            rightIcon={<ChevronLeft className="w-4 h-4" />}
          >
            التالي
          </Button>
        </div>
      )}

      {selectedOrderId !== null && (
        <EasyfyOrderDetailDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
};
