import React, { useEffect, useMemo, useState } from 'react';
import { OnlineOrder, PaymentMethod, ReturnItemCondition, formatCurrency } from '@pos-mandob/shared';
import { ArrowLeftRight, Trash2, X, AlertCircle } from 'lucide-react';
import { useCreateOnlineOrderExchange, useSwapOnlineOrderItems } from '../../../hooks/useExchange';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Input } from '../ui';
import { ExchangeProductPicker, SelectedExchangeVariantItem } from '../exchange/ExchangeProductPicker';

interface OnlineOrderExchangeModalProps {
  order: OnlineOrder | null;
  mode: 'SWAP' | 'EXCHANGE' | null;
  onClose: () => void;
}

interface ReturnedSelectionRow {
  key: string;
  product_id: number;
  product_variant_id: number | null;
  name: string;
  max_qty: number;
  unit_price: number;
  selected: boolean;
  quantity: number;
  condition: ReturnItemCondition;
}

export const OnlineOrderExchangeModal: React.FC<OnlineOrderExchangeModalProps> = ({ order, mode, onClose }) => {
  const toast = useToast();
  const swapMutation = useSwapOnlineOrderItems();
  const exchangeMutation = useCreateOnlineOrderExchange();

  const [returnedRows, setReturnedRows] = useState<ReturnedSelectionRow[]>([]);
  const [replacementItems, setReplacementItems] = useState<SelectedExchangeVariantItem[]>([]);
  const [shippingFee, setShippingFee] = useState<string>('50');
  const [surplusSettlement, setSurplusSettlement] = useState<'STORE_CREDIT' | 'REFUND_CASH'>('STORE_CREDIT');
  const [refundMethod, setRefundMethod] = useState<'INSTAPAY' | 'TRANSFER' | 'VODAFONE_CASH' | 'CASH'>(PaymentMethod.INSTAPAY);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!order || !mode) return;
    const rawItems = (order.items || []).filter((i: any) => i.product_id);
    const snapshot = Array.isArray(order.items_snapshot) ? order.items_snapshot : [];
    const discountRatio =
      Number(order.subtotal) > 0 && Number(order.discount_total) > 0
        ? Math.max(0, (Number(order.subtotal) - Number(order.discount_total)) / Number(order.subtotal))
        : 1;

    setReturnedRows(
      rawItems.map((oi: any, idx: number) => {
        const snap = snapshot.find(
          (s: any) =>
            Number(s.product_id) === Number(oi.product_id) &&
            Number(s.product_variant_id ?? 0) === Number(oi.product_variant_id ?? 0)
        ) || snapshot[idx];
        const rawUnit = Number(snap?.price ?? oi.variant?.selling_price ?? oi.product?.selling_price ?? 0);
        return {
          key: `${oi.id ?? idx}-${oi.product_id}-${oi.product_variant_id ?? 0}`,
          product_id: Number(oi.product_id),
          product_variant_id: oi.product_variant_id ? Number(oi.product_variant_id) : null,
          name: `${oi.product?.name || snap?.name || 'صنف'}${oi.variant?.name ? ` (${oi.variant.name})` : ''}`,
          max_qty: Number(oi.quantity) || 1,
          unit_price: Math.round(rawUnit * discountRatio * 100) / 100,
          selected: true,
          quantity: Number(oi.quantity) || 1,
          condition: ReturnItemCondition.SELLABLE,
        };
      })
    );
    setReplacementItems([]);
    setSurplusSettlement(order.party_id ? 'STORE_CREDIT' : 'REFUND_CASH');
  }, [order, mode]);

  const selectedReturned = useMemo(() => returnedRows.filter((r) => r.selected && r.quantity > 0), [returnedRows]);
  const returnTotal = useMemo(() => selectedReturned.reduce((s, r) => s + r.unit_price * r.quantity, 0), [selectedReturned]);
  const replacementTotal = useMemo(() => replacementItems.reduce((s, r) => s + r.unit_price * r.quantity, 0), [replacementItems]);
  const shipNum = Number(shippingFee) || 0;
  const netDiff = Math.round((replacementTotal + shipNum - returnTotal) * 100) / 100;

  if (!order || !mode) return null;

  const handleAddReplacement = (item: SelectedExchangeVariantItem) => {
    setReplacementItems((prev) => {
      const idx = prev.findIndex(
        (r) => r.product_id === item.product_id && (r.product_variant_id ?? null) === (item.product_variant_id ?? null)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, item];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replacementItems.length === 0) {
      toast.error('يرجى اختيار القطعة/المقاس البديل أولاً');
      return;
    }

    try {
      if (mode === 'SWAP') {
        await swapMutation.mutateAsync({
          orderId: order.id,
          items: replacementItems.map((i) => ({
            product_id: i.product_id,
            product_variant_id: i.product_variant_id ?? null,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          notes: notes || undefined,
        });
        toast.success('تم تبديل المقاس/الأصناف وتحديث المخزون المحجوز بنجاح');
      } else {
        if (selectedReturned.length === 0) {
          toast.error('يرجى تحديد قطعة واحدة مرتجعة على الأقل من الأوردر');
          return;
        }
        await exchangeMutation.mutateAsync({
          orderId: order.id,
          returned_items: selectedReturned.map((r) => ({
            product_id: r.product_id,
            product_variant_id: r.product_variant_id,
            quantity: r.quantity,
            condition: r.condition,
          })),
          replacement_items: replacementItems.map((i) => ({
            product_id: i.product_id,
            product_variant_id: i.product_variant_id ?? null,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          exchange_shipping_fee: shipNum,
          surplus_settlement: netDiff < 0 ? surplusSettlement : undefined,
          refund_method: netDiff < 0 && surplusSettlement === 'REFUND_CASH' ? refundMethod : undefined,
          notes: notes || undefined,
        });
        toast.success('تم إنشاء شحنة الاستبدال بنجاح وهي جاهزة للإسناد للمندوب أو شركة الشحن');
      }
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تنفيذ عملية الاستبدال للطلب');
    }
  };

  const isPending = swapMutation.isPending || exchangeMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4" dir="rtl">
      <form
        onSubmit={handleSubmit}
        className="bg-panel text-ink rounded-2xl max-w-xl w-full border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center gap-2 font-black text-sm">
            <ArrowLeftRight className="w-4 h-4 text-brand" />
            <span>
              {mode === 'SWAP'
                ? `تبديل مقاس/صنف قبل الشحن (${order.display_reference || order.external_order_number})`
                : `إنشاء شحنة استبدال للأوردر (${order.display_reference || order.external_order_number})`}
            </span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {mode === 'EXCHANGE' && (
            <div className="p-3 rounded-xl bg-warn-soft/50 border border-warn/30 space-y-2.5">
              <div className="font-black text-warn flex items-center justify-between">
                <span>1. حدد القطع المرتجعة من العميل فقط:</span>
                <span className="tabular-nums">{formatCurrency(returnTotal)}</span>
              </div>
              <div className="space-y-1.5">
                {returnedRows.map((row) => (
                  <div key={row.key} className="p-2 rounded-xl bg-panel border border-line flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          setReturnedRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, selected: e.target.checked } : r)))
                        }
                        className="w-4 h-4 accent-brand"
                      />
                      <span>{row.name}</span>
                      <span className="text-muted tabular-nums">({formatCurrency(row.unit_price)})</span>
                    </label>
                    {row.selected && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={row.max_qty}
                          value={row.quantity}
                          onChange={(e) => {
                            const val = Math.min(row.max_qty, Math.max(1, Number(e.target.value) || 1));
                            setReturnedRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, quantity: val } : r)));
                          }}
                          className="w-12 px-1.5 py-0.5 rounded-lg border border-line text-center font-bold tabular-nums"
                        />
                        <select
                          value={row.condition}
                          onChange={(e) =>
                            setReturnedRows((prev) =>
                              prev.map((r) => (r.key === row.key ? { ...r, condition: e.target.value as ReturnItemCondition } : r))
                            )
                          }
                          className="px-2 py-0.5 rounded-lg border border-line bg-surface-2 font-bold text-[11px]"
                        >
                          <option value={ReturnItemCondition.SELLABLE}>سليم</option>
                          <option value={ReturnItemCondition.DAMAGED}>تالف</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Input
                label="مصاريف شحن الاستبدال (COD على العميل - ج.م)"
                type="number"
                min={0}
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
              />
            </div>
          )}

          <ExchangeProductPicker
            branchId={order.branch_id ?? null}
            title={mode === 'EXCHANGE' ? '2. اختر الأصناف/المقاسات البديلة' : 'اختر الأصناف/المقاسات الجديدة للطلب'}
            onAdd={handleAddReplacement}
          />

          {replacementItems.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-ink">
                <span>البدائل المحددة:</span>
                <span className="tabular-nums text-ok">{formatCurrency(replacementTotal)}</span>
              </div>
              {replacementItems.map((item, idx) => (
                <div key={`${item.product_id}-${item.product_variant_id ?? 0}-${idx}`} className="flex justify-between items-center p-2 rounded-xl bg-surface-2 border border-line">
                  <div>
                    <span className="font-bold">{item.product_name}</span>
                    {item.variant_name && <Badge tone="ok" className="mr-1.5 text-[10px]">{item.variant_name}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-bold">{item.quantity} × {formatCurrency(item.unit_price)}</span>
                    <button type="button" onClick={() => setReplacementItems((prev) => prev.filter((_, i) => i !== idx))} className="text-bad">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mode === 'EXCHANGE' && selectedReturned.length > 0 && replacementItems.length > 0 && (
            <div className="p-3 rounded-xl bg-surface-2/80 border border-line space-y-2">
              {netDiff > 0 ? (
                <div className="flex justify-between font-black text-brand text-sm">
                  <span>المطلوب تحصيله عند التسليم (COD):</span>
                  <span className="tabular-nums">{formatCurrency(netDiff)}</span>
                </div>
              ) : netDiff === 0 ? (
                <div className="text-center font-black text-ok">
                  استبدال متساوي (مطلوب التحصيل COD: 0.00 ج.م)
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between font-black text-info text-sm">
                    <span>فائض لصالح العميلة (COD = 0):</span>
                    <span className="tabular-nums">{formatCurrency(Math.abs(netDiff))}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!order.party_id}
                      onClick={() => setSurplusSettlement('STORE_CREDIT')}
                      className={`p-2 rounded-xl border font-bold text-center ${
                        surplusSettlement === 'STORE_CREDIT' ? 'bg-brand-soft border-brand text-brand-ink' : 'bg-panel border-line text-muted'
                      } disabled:opacity-50`}
                    >
                      ترحيل لمحفظة العميلة عند التسليم
                    </button>
                    <button
                      type="button"
                      onClick={() => setSurplusSettlement('REFUND_CASH')}
                      className={`p-2 rounded-xl border font-bold text-center ${
                        surplusSettlement === 'REFUND_CASH' ? 'bg-warn-soft border-warn text-warn' : 'bg-panel border-line text-muted'
                      }`}
                    >
                      رد يدوي (إنستاباي / بنك)
                    </button>
                  </div>
                  {!order.party_id && surplusSettlement === 'STORE_CREDIT' && (
                    <div className="text-[11px] text-bad flex items-center gap-1 font-bold">
                      <AlertCircle className="w-3.5 h-3.5" /> الطلب غير مربوط بملف عميل؛ اختر الرد اليدوي عبر إنستاباي أو البنك.
                    </div>
                  )}
                  {surplusSettlement === 'REFUND_CASH' && (
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-line bg-panel font-bold text-xs"
                    >
                      <option value={PaymentMethod.INSTAPAY}>خصم من حساب إنستاباي (عند إتمام الاستلام)</option>
                      <option value={PaymentMethod.TRANSFER}>تحويل بنكي (عند إتمام الاستلام)</option>
                      <option value={PaymentMethod.VODAFONE_CASH}>فودافون كاش / محفظة (عند إتمام الاستلام)</option>
                      <option value={PaymentMethod.CASH}>رد نقدي من الخزنة (عند إتمام الاستلام)</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          <Input placeholder="ملاحظة للمندوب أو شركة الشحن..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-line">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isPending} disabled={isPending || replacementItems.length === 0}>
            {mode === 'SWAP' ? 'تأكيد تبديل الطلب' : 'إنشاء شحنة الاستبدال'}
          </Button>
        </div>
      </form>
    </div>
  );
};
