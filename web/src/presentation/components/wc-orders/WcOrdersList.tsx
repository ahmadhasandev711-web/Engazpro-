import React from 'react';
import { WcOrderMobileCard } from '../mobile/WcOrderMobileCard';
import { formatCurrency, WcOrderStatus, WcPaymentStatus } from '@pos-mandob/shared';
import { ShoppingBag, Truck, CheckCircle2, Phone, MapPin, DollarSign, RotateCcw, Package, Copy, Check, Printer, Calendar, Eye } from 'lucide-react';
import { cleanItemName, formatOrderDate, getStatusBadge, getCallConfirmedBadge } from './helpers';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import type { WcOrdersViewModel } from './types';

export const WcOrdersList: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const {
    isOwnerOrAdmin,
    isManager,
    isMandob,
    viewingOrder,
    setViewingOrder,
    setConfirmModalOrder,
    setSelectedBranchId,
    setConfirmError,
    setForceConfirm,
    setDispatchModalOrder,
    setSelectedMandobId,
    copiedTrackingId,
    setCopiedTrackingId,
    openDeliverModal,
    setPrintOrder,
    user,
    branches,
    mandobs,
    openCourierModal,
    orders,
    isLoading,
    returnMutation,
  } = vm;

  return (
    <>
      {isLoading ? (
        <div className="p-12 text-center text-muted font-bold text-xs bg-panel border border-line rounded-3xl">
          جاري تحميل الطلبيات...
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-6 h-6 text-muted" />}
          title="لا توجد طلبيات تطابق الفلتر المحدد"
          description="أي طلب يتم على متجرك في ووكومرس سيظهر هنا فورياً لتجهيزه وشحنه."
        />
      ) : (
        <>
          {/* Mobile Orders View: Dedicated Ergonomic Thumb-First Cards */}
          <div className="space-y-3.5 lg:hidden">
            {orders.map((order: any) => (
              <WcOrderMobileCard
                key={order.id}
                order={order}
                onViewDetails={(o) => setViewingOrder(o)}
                onPrint={(o) => setPrintOrder(o)}
                onConfirm={(o) => {
                  setConfirmModalOrder(o);
                  setSelectedBranchId(o.branch_id || (branches[0]?.id ?? ''));
                  setConfirmError(null);
                  setForceConfirm(false);
                }}
                onAssignCourier={(o) => openCourierModal(o)}
                onAssignMandob={(o) => {
                  setDispatchModalOrder(o);
                  setSelectedMandobId(o.mandob_id || (mandobs[0]?.id ?? ''));
                }}
                onDeliver={(o) => openDeliverModal(o)}
                canConfirm={isOwnerOrAdmin || isManager}
                canDispatch={isOwnerOrAdmin || isManager}
                canDeliver={isOwnerOrAdmin || isManager || isMandob}
              />
            ))}
          </div>

          {/* Desktop Orders View: Full Grid */}
          <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-2 gap-5">
            {orders.map((order: any) => {
              const isSelected = viewingOrder?.id === order.id;

              return (
                <div
                  key={order.id}
                  onClick={() => setViewingOrder(order)}
                  className={cn(
                    'bg-panel rounded-3xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all cursor-pointer',
                    isSelected
                      ? 'border-2 border-brand shadow-sm'
                      : 'border-line hover:border-line-2'
                  )}
                >
                  {/* Order Header */}
                  <div className="space-y-2 border-b border-line pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingOrder(order);
                          }}
                          className="text-xs font-black text-brand-ink bg-brand-soft hover:opacity-90 border border-brand/20 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="اضغط لعرض تفاصيل الطلب"
                        >
                          <span className="tabular-nums">#{order.wc_order_id}</span>
                          <span>🛒</span>
                        </button>
                        {(order.order_date || order.created_at) && (
                          <span className="text-2xs text-muted font-bold flex items-center gap-1 bg-surface-2 border border-line px-2 py-0.5 rounded-lg">
                            <Calendar className="w-3 h-3 text-muted" />
                            <span>{formatOrderDate(order)}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setViewingOrder(order)}
                          className="p-1.5 text-muted hover:text-brand hover:bg-surface-2 rounded-lg transition-all cursor-pointer"
                          title="عرض تفاصيل الأوردر الكاملة والصور"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {order.status !== WcOrderStatus.CANCELLED && (
                          <button
                            type="button"
                            onClick={() => setPrintOrder(order)}
                            className="p-1.5 text-muted hover:text-brand hover:bg-surface-2 rounded-lg transition-all cursor-pointer"
                            title="طباعة بوليصة التوصيل / الفاتورة"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {getCallConfirmedBadge(order)}
                        {getStatusBadge(order.status)}
                      </div>
                    </div>

                    {(() => {
                      const phone = order.customer_phone || order.party?.phone;
                      const address = order.customer_address || order.party?.address;
                      const gov = order.governorate || order.city;

                      return (
                        <div>
                          <h3 className="text-sm font-black text-ink">{order.customer_name}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-2xs text-muted mt-1.5">
                            {phone ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <a
                                  href={`tel:${phone}`}
                                  className="inline-flex items-center gap-1.5 text-ok font-bold bg-ok-soft hover:opacity-90 border border-ok/20 px-2.5 py-1 rounded-xl active:scale-95 transition-all tabular-nums"
                                  title="اتصال هاتفي مباشر"
                                >
                                  <Phone className="w-3.5 h-3.5 text-ok" />
                                  <span>{phone}</span>
                                </a>
                                <a
                                  href={`https://wa.me/${phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-ok text-on-brand hover:opacity-90 rounded-xl shadow-xs active:scale-90 transition-all flex items-center justify-center"
                                  title="محادثة واتساب"
                                >
                                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                                  </svg>
                                </a>
                              </div>
                            ) : (
                              <span className="flex items-center gap-1 text-muted">
                                <Phone className="w-3 h-3 text-muted opacity-50" /> -
                              </span>
                            )}
                            {gov && (
                              <span className="flex items-center gap-1 bg-surface-2 border border-line px-2 py-0.5 rounded-lg text-muted font-bold">
                                <MapPin className="w-3 h-3 text-muted" />
                                <span>{gov}</span>
                              </span>
                            )}
                          </div>
                          {address && (
                            <p className="text-2xs text-muted mt-1.5 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-muted shrink-0" />
                              <span className="truncate">{address}</span>
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Items Preview */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-black text-muted uppercase tracking-wider block">
                        الأصناف المطلوبة ({order.items_snapshot?.length || 0}):
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingOrder(order);
                        }}
                        className="text-2xs font-bold text-brand hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>التفاصيل والصور</span>
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {(order.items_snapshot || []).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs bg-surface-2/60 p-1.5 rounded-xl border border-line"
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={cleanItemName(item.name)}
                              className="w-8 h-8 rounded-lg object-cover border border-line shrink-0 bg-panel"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center shrink-0 text-muted">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-ink truncate block text-2xs">
                              {cleanItemName(item.name)}
                            </span>
                            {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                {item.attributes.map((attr: any, aIdx: number) => (
                                  <span
                                    key={aIdx}
                                    className="text-2xs bg-panel border border-line px-1.5 py-0.5 rounded text-muted font-bold"
                                  >
                                    {attr.key}: {attr.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-2xs font-black text-ink shrink-0 tabular-nums">
                            × {item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="p-3 bg-surface-2/60 rounded-2xl space-y-1 text-2xs border border-line">
                    <div className="flex justify-between text-muted">
                      <span>الشحن:</span>
                      <span className="font-bold tabular-nums">{formatCurrency(order.shipping_cost)}</span>
                    </div>
                    {order.discount_total > 0 && (
                      <div className="flex justify-between text-ok">
                        <span>خصم كوبون:</span>
                        <span className="font-bold tabular-nums">-{formatCurrency(order.discount_total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-black text-ink border-t border-line pt-1">
                      <span>الإجمالي المطلوب:</span>
                      <span className="text-brand font-black tabular-nums">{formatCurrency(order.total)}</span>
                    </div>
                  </div>

                  {/* Info Badges (Branch & Mandob / Courier) */}
                  <div className="space-y-1.5 pt-1 text-2xs text-muted">
                    <div className="flex items-center justify-between">
                      <span>فرع التجهيز: {order.branch?.name || 'غير محدد'}</span>
                      {order.mandob && (
                        <span className="font-bold text-info">المندوب: {order.mandob.name}</span>
                      )}
                    </div>

                    {/* Courier info if assigned */}
                    {(order.shipping_type === 'COURIER' || order.status === WcOrderStatus.SHIPPED_VIA_COURIER || order.courier_name) && (
                      <div className="p-2.5 bg-surface-2 rounded-2xl border border-line text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-ink flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-info" />
                            {order.courier_name || 'شركة شحن خارجية'}
                          </span>
                          {order.tracking_number && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(order.tracking_number);
                                setCopiedTrackingId(order.id);
                                setTimeout(() => setCopiedTrackingId(null), 2000);
                              }}
                              className="flex items-center gap-1 text-2xs text-ink bg-panel px-2 py-0.5 rounded-lg border border-line hover:bg-surface-2 transition-all cursor-pointer shadow-2xs tabular-nums"
                              title="نسخ رقم البوليصة"
                            >
                              {copiedTrackingId === order.id ? (
                                <>
                                  <Check className="w-3 h-3 text-ok" />
                                  <span className="text-ok font-bold">تم النسخ</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-muted" />
                                  <span className="font-bold">{order.tracking_number}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons based on Status */}
                  <div className="pt-2 border-t border-line" onClick={(e) => e.stopPropagation()}>
                    {!isMandob && order.status === WcOrderStatus.PENDING_CONFIRMATION && (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => {
                          setConfirmModalOrder(order);
                          setConfirmError(null);
                          setForceConfirm(false);
                          const defaultBranch = isManager
                            ? branches.find((b: any) => b.id === user?.branch_id)
                            : (branches.find((b: any) => b.id === order.branch_id) ||
                               branches.find((b: any) => b.is_main) ||
                               branches[0]);
                          setSelectedBranchId(defaultBranch?.id ?? (user?.branch_id ?? ''));
                        }}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        className="w-full font-black text-xs"
                      >
                        تأكيد الطلب وتحديد المخزن
                      </Button>
                    )}

                    {!isMandob && order.status === WcOrderStatus.CONFIRMED && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-2xs">
                          <span className="text-muted font-bold">طريقة الشحن والتوصيل:</span>
                          {(() => {
                            const isLocal = /قاهرة|جيزة|cairo|giza/i.test(order.governorate || order.city || '');
                            return isLocal ? (
                              <Badge tone="ok" className="font-bold text-2xs">
                                💡 مقترح: مندوب المتجر
                              </Badge>
                            ) : (
                              <Badge tone="info" className="font-bold text-2xs">
                                💡 مقترح: شركة شحن
                              </Badge>
                            );
                          })()}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={() => {
                              setDispatchModalOrder(order);
                              setSelectedMandobId(order.mandob_id || (mandobs[0]?.id ?? ''));
                            }}
                            leftIcon={<Truck className="w-3.5 h-3.5" />}
                            className="font-black text-xs"
                          >
                            إسناد لمندوب
                          </Button>

                          <Button
                            variant="secondary"
                            size="md"
                            onClick={() => openCourierModal(order)}
                            leftIcon={<Package className="w-3.5 h-3.5" />}
                            className="font-black text-xs"
                          >
                            إسناد لشركة شحن
                          </Button>
                        </div>
                      </div>
                    )}

                    {order.status === WcOrderStatus.DISPATCHED && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => openDeliverModal(order)}
                          leftIcon={<DollarSign className="w-4 h-4" />}
                          className="font-black text-xs"
                        >
                          {order.payment_status === WcPaymentStatus.PAID_ONLINE ? 'تأكيد التسليم' : 'تسليم وتحصيل'}
                        </Button>
                        <Button
                          variant="danger"
                          size="md"
                          onClick={() => returnMutation.mutate(order.id)}
                          disabled={returnMutation.isPending}
                          isLoading={returnMutation.isPending}
                          leftIcon={<RotateCcw className="w-4 h-4" />}
                          className="font-black text-xs"
                        >
                          مرتجع
                        </Button>
                      </div>
                    )}

                    {order.status === WcOrderStatus.SHIPPED_VIA_COURIER && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => openDeliverModal(order)}
                          leftIcon={<DollarSign className="w-4 h-4" />}
                          className="font-black text-xs"
                        >
                          {order.payment_status === WcPaymentStatus.PAID_ONLINE ? 'تأكيد تسليم الشحنة' : 'تسليم وتحصيل COD'}
                        </Button>
                        <Button
                          variant="danger"
                          size="md"
                          onClick={() => returnMutation.mutate(order.id)}
                          disabled={returnMutation.isPending}
                          isLoading={returnMutation.isPending}
                          leftIcon={<RotateCcw className="w-4 h-4" />}
                          className="font-black text-xs"
                        >
                          مرتجع شحن
                        </Button>
                      </div>
                    )}

                    {order.status === WcOrderStatus.DELIVERED && (
                      <div className="space-y-2">
                        <div className="text-center py-2 text-xs font-bold text-ok bg-ok-soft rounded-xl border border-ok/20">
                          تم التسليم وإصدار الفاتورة بنجاح ✅
                        </div>
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => setPrintOrder(order)}
                          leftIcon={<Printer className="w-3.5 h-3.5 text-muted" />}
                          className="w-full font-bold text-xs"
                        >
                          طباعة بوليصة التوصيل / الفاتورة
                        </Button>
                      </div>
                    )}

                    {order.status === WcOrderStatus.RETURNED && (
                      <div className="text-center py-2 text-xs font-bold text-bad bg-bad-soft rounded-xl border border-bad/20">
                        تم تسجيل الطلب كمرتجع ↩️
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};
