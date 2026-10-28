import React from 'react';
import { WcOrderMobileCard } from '../mobile/WcOrderMobileCard';
import { formatCurrency } from '@pos-mandob/shared';
import { ShoppingBag, Truck, CheckCircle2, Phone, MapPin, DollarSign, RotateCcw, Package, Copy, Check, Printer, Calendar, Eye } from 'lucide-react';
import { cleanItemName, formatOrderDate, getStatusBadge } from './helpers';
import type { WcOrdersViewModel } from './types';

export const WcOrdersList: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const { isOwnerOrAdmin, isManager, isMandob, setViewingOrder, setConfirmModalOrder, setSelectedBranchId, setConfirmError, setForceConfirm, setDispatchModalOrder, setSelectedMandobId, copiedTrackingId, setCopiedTrackingId, openDeliverModal, setPrintOrder, user, branches, mandobs, openCourierModal, orders, isLoading, returnMutation } = vm;

  return (
    <>
      {/* Orders List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-bold text-xs">جاري تحميل الطلبيات...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600">لا توجد طلبيات تطابق الفلتر المحدد</p>
          <p className="text-xs text-slate-400">أي طلب يتم على متجرك في ووكومرس سيظهر هنا فورياً لتجهيزه وشحنه.</p>
        </div>
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
          <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {orders.map((order: any) => (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              {/* Order Header */}
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setViewingOrder(order)}
                      className="text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-2.5 py-0.5 rounded-lg font-mono transition-colors cursor-pointer flex items-center gap-1"
                      title="اضغط لعرض تفاصيل الطلب والصور"
                    >
                      <span>#{order.wc_order_id}</span>
                      <span>🛒</span>
                    </button>
                    {(order.order_date || order.created_at) && (
                      <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg font-sans">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatOrderDate(order)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingOrder(order)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                      title="عرض تفاصيل الأوردر الكاملة والصور"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {order.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => setPrintOrder(order)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                        title="طباعة بوليصة التوصيل / الفاتورة"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    )}
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {(() => {
                  const phone = order.customer_phone || order.party?.phone;
                  const address = order.customer_address || order.party?.address;
                  const gov = order.governorate || order.city;

                  return (
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{order.customer_name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1.5 font-mono">
                        {phone ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${phone}`}
                              className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-xl active:scale-95 transition-all"
                              title="اتصال هاتفي مباشر"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{phone}</span>
                            </a>
                            <a
                              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-xs active:scale-90 transition-all flex items-center justify-center"
                              title="محادثة واتساب"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                              </svg>
                            </a>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Phone className="w-3 h-3 text-slate-300" /> -
                          </span>
                        )}
                        {gov && (
                          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {gov}
                          </span>
                        )}
                      </div>
                      {address && (
                        <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1 truncate font-sans">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{address}</span>
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    الأصناف المطلوبة ({order.items_snapshot?.length || 0}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewingOrder(order)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>التفاصيل والصور</span>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {(order.items_snapshot || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={cleanItemName(item.name)}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-200/60 flex items-center justify-center shrink-0 text-slate-400">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-800 truncate block text-[11px]">{cleanItemName(item.name)}</span>
                        {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {item.attributes.map((attr: any, aIdx: number) => (
                              <span key={aIdx} className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-600 font-bold">
                                {attr.key}: {attr.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-[11px] font-black text-slate-700 shrink-0">
                        × {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1 text-[11px] border border-slate-100">
                <div className="flex justify-between text-slate-500">
                  <span>الشحن:</span>
                  <span className="font-mono font-bold">{formatCurrency(order.shipping_cost)}</span>
                </div>
                {order.discount_total > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>خصم كوبون:</span>
                    <span className="font-mono font-bold">-{formatCurrency(order.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black text-slate-900 border-t border-slate-200/60 pt-1">
                  <span>الإجمالي المطلوب:</span>
                  <span className="font-mono text-primary-700">{formatCurrency(order.total)}</span>
                </div>
              </div>

              {/* Info Badges (Branch & Mandob / Courier) */}
              <div className="space-y-1.5 pt-1 text-[11px] text-slate-500">
                <div className="flex items-center justify-between">
                  <span>فرع التجهيز: {order.branch?.name || 'غير محدد'}</span>
                  {order.mandob && <span className="font-bold text-indigo-700">المندوب: {order.mandob.name}</span>}
                </div>

                {/* Courier info if assigned */}
                {(order.shipping_type === 'COURIER' || order.status === 'SHIPPED_VIA_COURIER' || order.courier_name) && (
                  <div className="p-2.5 bg-purple-50/70 rounded-2xl border border-purple-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-purple-900 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-purple-600" />
                        {order.courier_name || 'شركة شحن خارجية'}
                      </span>
                      {order.tracking_number && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(order.tracking_number);
                            setCopiedTrackingId(order.id);
                            setTimeout(() => setCopiedTrackingId(null), 2000);
                          }}
                          className="flex items-center gap-1 text-[11px] font-mono text-purple-800 bg-white px-2 py-0.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition-all cursor-pointer shadow-2xs"
                          title="نسخ رقم البوليصة"
                        >
                          {copiedTrackingId === order.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-purple-500" />
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
              <div className="pt-2 border-t border-slate-100">
                {!isMandob && order.status === 'PENDING_CONFIRMATION' && (
                  <button
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
                    className="w-full py-2.5 bg-primary-600 text-slate-950 rounded-xl text-xs font-black hover:bg-primary-500 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الطلب وتحديد المخزن</span>
                  </button>
                )}

                {!isMandob && order.status === 'CONFIRMED' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-bold">طريقة الشحن والتوصيل:</span>
                      {(() => {
                        const isLocal = /قاهرة|جيزة|cairo|giza/i.test(order.governorate || order.city || '');
                        return isLocal ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                            💡 مقترح: مندوب المتجر
                          </span>
                        ) : (
                          <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-md border border-purple-200">
                            💡 مقترح: شركة شحن
                          </span>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setDispatchModalOrder(order);
                          setSelectedMandobId(order.mandob_id || (mandobs[0]?.id ?? ''));
                        }}
                        className="py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>إسناد لمندوب</span>
                      </button>

                      <button
                        onClick={() => openCourierModal(order)}
                        className="py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black hover:bg-purple-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>إسناد لشركة شحن</span>
                      </button>
                    </div>
                  </div>
                )}

                {order.status === 'DISPATCHED' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openDeliverModal(order)}
                      className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{order.payment_status === 'PAID_ONLINE' ? 'تأكيد التسليم' : 'تسليم وتحصيل'}</span>
                    </button>
                    <button
                      onClick={() => returnMutation.mutate(order.id)}
                      disabled={returnMutation.isPending}
                      className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>مرتجع</span>
                    </button>
                  </div>
                )}

                {order.status === 'SHIPPED_VIA_COURIER' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openDeliverModal(order)}
                      className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{order.payment_status === 'PAID_ONLINE' ? 'تأكيد تسليم الشحنة' : 'تسليم وتحصيل COD'}</span>
                    </button>
                    <button
                      onClick={() => returnMutation.mutate(order.id)}
                      disabled={returnMutation.isPending}
                      className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>مرتجع شحن</span>
                    </button>
                  </div>
                )}

                {order.status === 'DELIVERED' && (
                  <div className="space-y-2">
                    <div className="text-center py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                      تم التسليم وإصدار الفاتورة بنجاح ✅
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrintOrder(order)}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>طباعة بوليصة التوصيل / الفاتورة</span>
                    </button>
                  </div>
                )}

                {order.status === 'RETURNED' && (
                  <div className="text-center py-1.5 text-xs font-bold text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
                    تم تسجيل الطلب كمرتجع ↩️
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </>
  );
};
