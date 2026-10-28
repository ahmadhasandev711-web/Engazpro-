import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { ShoppingBag, Truck, CheckCircle2, X, Phone, MapPin, DollarSign, RotateCcw, Package, Printer, Calendar } from 'lucide-react';
import { cleanItemName, formatOrderDate, getStatusBadge } from './helpers';
import type { WcOrdersViewModel } from './types';

export const WcOrderDetailsModal: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const { isManager, isMandob, viewingOrder, setViewingOrder, setConfirmModalOrder, setSelectedBranchId, setConfirmError, setForceConfirm, setDispatchModalOrder, setSelectedMandobId, setCourierModalOrder, setCourierName, setCourierPartyId, setCourierTrackingNumber, setCourierBranchId, openDeliverModal, setPrintOrder, user, branches, mandobs, couriers, returnMutation } = vm;

  return (
    <>
      {/* Modal 0: Order Details Modal (نافذة تفاصيل الأوردر الشاملة مع صور المنتجات والسمات) */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 font-mono">
                      طلب ووكومرس #{viewingOrder.wc_order_id}
                    </h2>
                    {getStatusBadge(viewingOrder.status)}
                  </div>
                  {(viewingOrder.order_date || viewingOrder.created_at) && (
                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>تاريخ الطلب: {formatOrderDate(viewingOrder)}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {viewingOrder.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => setPrintOrder(viewingOrder)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border border-slate-200/80"
                    title="طباعة بوليصة التوصيل / الفاتورة"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingOrder(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto py-3 space-y-3.5 pr-1 flex-1">
              {/* Customer Information Card */}
              {(() => {
                const phone = viewingOrder.customer_phone || viewingOrder.party?.phone;
                const address = viewingOrder.customer_address || viewingOrder.party?.address;
                const gov = viewingOrder.governorate || viewingOrder.city;
                const cleanPhoneForWa = phone ? phone.replace(/\D/g, '') : '';
                const waUrl = cleanPhoneForWa
                  ? (cleanPhoneForWa.startsWith('2') ? `https://wa.me/${cleanPhoneForWa}` : `https://wa.me/2${cleanPhoneForWa}`)
                  : null;

                return (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">بيانات العميل:</span>
                        <h3 className="text-sm font-black text-slate-900 mt-0.5">{viewingOrder.customer_name}</h3>
                      </div>

                      {/* Quick Contact Buttons (WhatsApp & Call) */}
                      <div className="flex items-center gap-2">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-mono">{phone}</span>
                          </a>
                        )}
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-emerald-600/20 active:scale-95"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                            </svg>
                            <span>محادثة واتساب</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Customer Address */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                      {gov && (
                        <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-bold text-slate-700">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{gov}</span>
                        </span>
                      )}
                      {address && (
                        <span className="font-medium text-slate-600">
                          {address}
                        </span>
                      )}
                    </div>

                    {/* Customer Note from WooCommerce */}
                    {viewingOrder.notes && (
                      <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 flex items-start gap-2">
                        <span className="font-bold shrink-0">ملاحظات العميل:</span>
                        <span className="leading-relaxed font-medium">{viewingOrder.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Products & Line Items with Images */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>الأصناف والمنتجات المطلوبة ({viewingOrder.items_snapshot?.length || 0})</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                  {(viewingOrder.items_snapshot || []).map((item: any, idx: number) => {
                    const qty = Math.max(1, Number(item.quantity) || 1);
                    const unitPrice = item.price || (item.subtotal ? item.subtotal / qty : 0);
                    const lineTotal = item.total || item.subtotal || (unitPrice * qty);

                    return (
                      <div key={idx} className="p-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                        {/* Thumbnail Image */}
                        <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={cleanItemName(item.name)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">
                            {cleanItemName(item.name)}
                          </h4>

                          {/* Variation Attributes */}
                          {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {item.attributes.map((attr: any, aIdx: number) => (
                                <span
                                  key={aIdx}
                                  className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                                >
                                  <span className="text-slate-400 ml-1">{attr.key}:</span>
                                  <span>{attr.value}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                            <span>سعر الوحدة: <strong className="text-slate-700">{formatCurrency(unitPrice)}</strong></span>
                            <span>الكمية: <strong className="text-slate-900">× {item.quantity}</strong></span>
                          </div>
                        </div>

                        {/* Line Total */}
                        <div className="text-left font-mono font-black text-xs text-slate-900 shrink-0">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي المنتجات:</span>
                  <span className="font-mono font-bold">{formatCurrency(viewingOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>تكلفة الشحن والتوصيل:</span>
                  <span className="font-mono font-bold">{formatCurrency(viewingOrder.shipping_cost)}</span>
                </div>
                {viewingOrder.discount_total > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span className="flex items-center gap-1">
                      <span>خصم الكوبون:</span>
                      {viewingOrder.wc_coupon_codes && viewingOrder.wc_coupon_codes.length > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
                          {viewingOrder.wc_coupon_codes.join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold">-{formatCurrency(viewingOrder.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>الإجمالي النهائي المطلوب تحصيله:</span>
                  <span className="font-mono text-primary-700 text-base">{formatCurrency(viewingOrder.total)}</span>
                </div>
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold text-slate-700">
                    {viewingOrder.payment_status === 'PAID_ONLINE' ? '💳 مدفوع أونلاين' : '💵 الدفع عند الاستلام (COD)'}
                    {viewingOrder.wc_payment_method ? ` (${viewingOrder.wc_payment_method})` : ''}
                  </span>
                </div>
              </div>

              {/* Logistics & Assignment Card */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">فرع التجهيز والمخزون:</span>
                  <span className="font-bold text-slate-900">{viewingOrder.branch?.name || 'لم يحدد بعد'}</span>
                </div>
                {viewingOrder.mandob && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">المندوب المسند له:</span>
                    <span className="font-bold text-indigo-800">{viewingOrder.mandob.name}</span>
                  </div>
                )}
                {viewingOrder.courier_name && (
                  <div className="flex items-center justify-between border-t border-indigo-100/60 pt-1.5">
                    <span className="text-slate-600">شركة الشحن:</span>
                    <span className="font-bold text-purple-900">{viewingOrder.courier_name}</span>
                  </div>
                )}
                {viewingOrder.tracking_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">رقم البوليصة:</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {viewingOrder.tracking_number}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 shrink-0">
              {!isMandob && viewingOrder.status === 'PENDING_CONFIRMATION' && (
                <button
                  onClick={() => {
                    const order = viewingOrder;
                    setViewingOrder(null);
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
                  className="flex-1 py-2.5 bg-primary-600 text-slate-950 rounded-xl text-xs font-black hover:bg-primary-500 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد الطلب وتحديد المخزن</span>
                </button>
              )}

              {!isMandob && viewingOrder.status === 'CONFIRMED' && (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      setDispatchModalOrder(order);
                      setSelectedMandobId(order.mandob_id || (mandobs[0]?.id ?? ''));
                    }}
                    className="py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>إسناد لمندوب</span>
                  </button>
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      setCourierModalOrder(order);
                      setCourierBranchId(order.branch_id || branches[0]?.id || '');
                      setCourierTrackingNumber(order.tracking_number || '');
                      const found = couriers.find((c: any) => c.id === order.courier_party_id || c.name === order.courier_name);
                      setCourierPartyId(found?.id || order.courier_party_id || '');
                      setCourierName(found?.name || order.courier_name || '');
                    }}
                    className="py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black hover:bg-purple-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>إسناد لشركة شحن</span>
                  </button>
                </div>
              )}

              {viewingOrder.status === 'DISPATCHED' && (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      openDeliverModal(order);
                    }}
                    className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>{viewingOrder.payment_status === 'PAID_ONLINE' ? 'تأكيد التسليم' : 'تسليم وتحصيل'}</span>
                  </button>
                  <button
                    onClick={() => {
                      const orderId = viewingOrder.id;
                      setViewingOrder(null);
                      returnMutation.mutate(orderId);
                    }}
                    disabled={returnMutation.isPending}
                    className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>مرتجع</span>
                  </button>
                </div>
              )}

              {viewingOrder.status === 'SHIPPED_VIA_COURIER' && (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      openDeliverModal(order);
                    }}
                    className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>{viewingOrder.payment_status === 'PAID_ONLINE' ? 'تأكيد تسليم الشحنة' : 'تسليم وتحصيل COD'}</span>
                  </button>
                  <button
                    onClick={() => {
                      const orderId = viewingOrder.id;
                      setViewingOrder(null);
                      returnMutation.mutate(orderId);
                    }}
                    disabled={returnMutation.isPending}
                    className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>مرتجع شحن</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
