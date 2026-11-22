import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  RefreshCw,
  Search,
  User as UserIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { EasyfyOrderStatus, formatCurrency } from '@pos-mandob/shared';
import { useEasyfyOrders, useReorderEasyfyOrder } from '../../../hooks/useEasyfyShop';
import { useToast } from '../../context/ToastContext';
import {
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_META,
} from '../../components/admin/easyfy/easyfyUiMeta';
import { ShopTopBar } from '../../components/shop/ShopTopBar';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '../../components/ui';

export const ShopOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<EasyfyOrderStatus | ''>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const { data: ordersPage, isLoading } = useEasyfyOrders({
    status: statusFilter,
    search,
    page,
  });
  const reorderMutation = useReorderEasyfyOrder();

  const handleReorder = async (orderId: number) => {
    try {
      const result = await reorderMutation.mutateAsync(orderId);
      if (result.skipped_items.length > 0) {
        toast.info(
          `تمت إضافة الأصناف المتاحة، وتم تخطي ${result.skipped_items.length} أصناف غير متوفرة حالياً.`
        );
      } else {
        toast.success('تم نسخ جميع أصناف الطلب إلى سلتك بنجاح!');
      }
      navigate('/shop/cart');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر إعادة تكرار الطلب');
    }
  };

  const orders = ordersPage?.items ?? [];

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="طلبات مستلزمات المتجر"
        description="متابعة حالة طلبات الشحن والتغليف الخاصة بمتجرك، مع إمكانية إعادة الطلب بضغطة زر لأي عضو في الفريق."
      />

      <ShopTopBar />

      <Card className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Input
            placeholder="بحث برقم الطلب (ESF-...) أو اسم المستلم..."
            leftIcon={<Search className="w-4 h-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as EasyfyOrderStatus | '');
            setPage(1);
          }}
          options={[
            { value: '', label: 'كل حالات الطلبات' },
            { value: EasyfyOrderStatus.PENDING, label: 'قيد المراجعة' },
            { value: EasyfyOrderStatus.CONFIRMED, label: 'مؤكد' },
            { value: EasyfyOrderStatus.PREPARING, label: 'قيد التجهيز' },
            { value: EasyfyOrderStatus.SHIPPED, label: 'تم الشحن' },
            { value: EasyfyOrderStatus.DELIVERED, label: 'تم التسليم' },
            { value: EasyfyOrderStatus.CANCELLED, label: 'ملغي' },
          ]}
        />
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-9 h-9 text-muted" />}
          title="لا توجد طلبات مستلزمات بعد"
          description="عند إتمام أول طلب من متجر Easyfy ستتمكن من تتبع شحنته وإعادة طلبه من هنا."
          action={
            <Button size="sm" onClick={() => navigate('/shop')}>
              ابدأ التسوق الآن
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
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
              <Card key={order.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Link
                      to={`/shop/orders/${order.id}`}
                      className="font-black text-base text-brand-ink hover:underline"
                    >
                      {order.order_number}
                    </Link>
                    <Badge tone={stMeta.tone}>{stMeta.label}</Badge>
                    <Badge tone={payMeta.tone}>{payMeta.label}</Badge>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
                    <span>
                      التاريخ:{' '}
                      {order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '-'}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5" />
                      أنشأه: <strong className="text-ink">{order.ordered_by_name || '-'}</strong>
                    </span>
                    <span>•</span>
                    <span>{PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-line">
                  <div className="text-right md:text-left">
                    <p className="text-[11px] text-muted font-bold">الإجمالي</p>
                    <p className="text-base font-black text-ink tabular-nums">
                      {formatCurrency(order.total_amount)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={reorderMutation.isPending}
                      onClick={() => handleReorder(order.id)}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      إعادة الطلب
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/shop/orders/${order.id}`)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      التفاصيل
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {ordersPage && ordersPage.last_page > 1 && (
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
            صفحة {ordersPage.current_page} من {ordersPage.last_page}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= ordersPage.last_page}
            onClick={() => setPage((p) => p + 1)}
            rightIcon={<ChevronLeft className="w-4 h-4" />}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
};
