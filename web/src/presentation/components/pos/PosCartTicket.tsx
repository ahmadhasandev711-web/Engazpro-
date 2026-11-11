import React, { useState } from 'react';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  PauseCircle,
  CreditCard,
  Percent,
  Truck,
  X,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../data/api/client';
import { PosCartItem } from '../../../hooks/useHoldInvoices';
import { PosCustomerSearch } from './PosCustomerSearch';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

export interface CustomerParty {
  id: number;
  name: string;
  phone?: string;
  balance?: number;
}

interface PosCartTicketProps {
  items: PosCartItem[];
  selectedCustomer: CustomerParty | null;
  onSelectCustomer: (customer: CustomerParty | null) => void;
  onUpdateQuantity: (productId: number, newQty: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  discount: number;
  onUpdateDiscount: (discount: number) => void;
  shippingCost?: number;
  onUpdateShippingCost?: (cost: number) => void;
  courierPartyId?: number | null;
  onUpdateCourierPartyId?: (id: number | null) => void;
  onHoldCart: () => void;
  onCheckout: () => void;
  onQuickAddCustomer: (name: string, phone?: string) => Promise<CustomerParty | void>;
}

export const PosCartTicket: React.FC<PosCartTicketProps> = ({
  items,
  selectedCustomer,
  onSelectCustomer,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  discount,
  onUpdateDiscount,
  shippingCost = 0,
  onUpdateShippingCost,
  courierPartyId = null,
  onUpdateCourierPartyId,
  onHoldCart,
  onCheckout,
  onQuickAddCustomer,
}) => {
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [isAddingCust, setIsAddingCust] = useState(false);

  // Fetch Couriers for shipping
  const { data: couriers = [] } = useQuery({
    queryKey: ['parties', 'COURIER'],
    queryFn: async () => {
      const res = await apiClient.get('/parties', { params: { type: 'COURIER', per_page: 100 } });
      return res.data?.data || [];
    },
  });

  const [isShippingSelected, setIsShippingSelected] = useState(Boolean(shippingCost > 0 || courierPartyId));
  const [discountMode, setDiscountMode] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');

  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const total = Math.max(0, subtotal - discount + (shippingCost || 0));
  const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    setIsAddingCust(true);
    try {
      const created = await onQuickAddCustomer(newCustName.trim(), newCustPhone.trim() || undefined);
      if (created) {
        onSelectCustomer(created);
      }
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
    } finally {
      setIsAddingCust(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel rounded-3xl border border-line shadow-xs overflow-hidden">
      {/* Ticket Header & Customer Selector */}
      <div className="p-4 border-b border-line bg-surface-1/50 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand text-on-brand rounded-xl shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink">سلة الفاتورة الحالية</h3>
              <span className="text-2xs text-muted font-medium">
                {totalItemsCount} قطعة ({items.length} صنف)
              </span>
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              title="إفراغ السلة"
              className="text-muted hover:text-bad p-2 min-h-[44px] min-w-[44px] rounded-xl hover:bg-bad-soft transition-colors text-xs flex items-center justify-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline font-bold">مسح السلة</span>
            </button>
          )}
        </div>

        {/* High-Performance Searchable Customer Row */}
        <div className="flex items-center">
          <PosCustomerSearch
            selectedCustomer={selectedCustomer}
            onSelectCustomer={onSelectCustomer}
            onOpenAddModal={(initialName) => {
              if (initialName) setNewCustName(initialName);
              setShowAddCustomerModal(true);
            }}
          />
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <EmptyState
              icon={<ShoppingBag className="w-6 h-6 text-muted" />}
              title="السلة فارغة حالياً"
              description="انقر على أي منتج من الكتالوج أو استخدم قارئ الباركود للإضافة الفورية."
              className="bg-transparent border-0 py-8"
            />
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.product_id}_${item.product_variant_id || 0}_${item.product_batch_id || 0}_${item.unit_name || ''}_${index}`}
              className="p-3 bg-surface-1/60 border border-line rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 hover:bg-surface-2 transition-colors"
            >
              {/* Product Info & Badges */}
              <div className="basis-full sm:basis-auto flex-1 min-w-0">
                <h4 className="text-xs font-black text-ink break-words leading-tight">
                  {item.product_name}
                </h4>

                {/* Variant & Unit Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {item.variant_name && (
                    <Badge tone="info" className="text-2xs px-2 py-0.5 rounded-md font-bold">
                      {item.variant_name}
                    </Badge>
                  )}
                  {item.unit_name && (
                    <Badge tone="neutral" className="text-2xs px-2 py-0.5 rounded-md font-bold">
                      {item.unit_name}
                    </Badge>
                  )}
                  {item.batch_number && (
                    <Badge tone="ok" className="text-2xs px-2 py-0.5 rounded-md font-bold">
                      تشغيلة: {item.batch_number}
                    </Badge>
                  )}
                  <span className="text-2xs text-muted font-medium">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </span>
                </div>
              </div>

              {/* Stepper, Line Total & Remove Container (Row 2 on Mobile, Inline on Desktop) */}
              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t border-line/40 sm:border-0">
                {/* Quantity Stepper Buttons with Accessible Touch Targets (>= 44px) */}
                <div className="flex items-center gap-1 bg-panel p-1 border border-line rounded-xl">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                    aria-label="تقليل الكمية"
                    className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg bg-surface-2 hover:bg-line text-ink flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > 0) onUpdateQuantity(index, val);
                    }}
                    className="w-12 sm:w-10 min-w-[2.75rem] text-center font-black text-xs text-ink bg-transparent border-none focus:outline-none p-0"
                  />

                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                    aria-label="زيادة الكمية"
                    className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg bg-surface-2 hover:bg-line text-ink flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Line Total & Remove with Accessible Touch Target (>= 44px) */}
                <div className="flex items-center gap-2 text-right">
                  <span className="font-black text-xs text-brand min-w-[60px]">
                    {formatCurrency(item.total)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(index)}
                    aria-label="حذف الصنف"
                    className="text-muted hover:text-bad p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-bad-soft transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ticket Footer (Totals & Actions) */}
      <div className="p-4 border-t border-line bg-surface-1/50 space-y-3">
        {/* Subtotal and Discount Row */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-muted">
            <span>المجموع الفرعي:</span>
            <span className="font-bold text-ink">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-muted" />
              <span>خصم الفاتورة:</span>
            </span>
            <div className="flex items-center gap-1 w-32 sm:w-28">
              <input
                type="number"
                min="0"
                step="1"
                value={
                  discountMode === 'PERCENT'
                    ? subtotal > 0 && discount > 0
                      ? Number(((discount / subtotal) * 100).toFixed(2))
                      : ''
                    : discount || ''
                }
                onChange={(e) => {
                  const raw = Number(e.target.value) || 0;
                  if (discountMode === 'PERCENT') {
                    onUpdateDiscount(Number(((subtotal * raw) / 100).toFixed(2)));
                  } else {
                    onUpdateDiscount(raw);
                  }
                }}
                placeholder="0.00"
                className="w-full text-left font-bold text-xs px-2 py-1 bg-panel border border-line rounded-lg text-bad focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                type="button"
                onClick={() => setDiscountMode((m) => (m === 'AMOUNT' ? 'PERCENT' : 'AMOUNT'))}
                title={discountMode === 'AMOUNT' ? 'التبديل إلى خصم بالنسبة المئوية' : 'التبديل إلى خصم بمبلغ ثابت'}
                className="w-8 shrink-0 text-2xs font-black rounded-lg border border-line bg-panel text-bad hover:bg-bad-soft active:scale-95 transition-all py-1"
              >
                {discountMode === 'AMOUNT' ? 'ج.م' : '%'}
              </button>
            </div>
          </div>

          {/* Courier & Shipping Section */}
          <div className="pt-1.5 space-y-2 border-t border-line/40">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-ink select-none">
                <input
                  type="checkbox"
                  checked={isShippingSelected || Boolean(shippingCost > 0 || courierPartyId)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsShippingSelected(checked);
                    if (!checked) {
                      onUpdateShippingCost?.(0);
                      onUpdateCourierPartyId?.(null);
                    }
                  }}
                  className="w-4 h-4 rounded border-line text-brand focus:ring-brand cursor-pointer"
                />
                <span className="font-bold text-xs flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-muted" />
                  <span>شحن عبر شركة شحن</span>
                </span>
              </label>

              {(isShippingSelected || Boolean(shippingCost > 0 || courierPartyId)) && (
                <div className="flex items-center gap-1 w-28 sm:w-24">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={shippingCost || ''}
                    onChange={(e) => onUpdateShippingCost?.(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full text-left font-bold text-xs px-2 py-1 bg-panel border border-line rounded-lg text-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-2xs text-muted font-bold">ج.م</span>
                </div>
              )}
            </div>

            {(isShippingSelected || Boolean(shippingCost > 0 || courierPartyId)) && (
              <div className="bg-brand-soft/40 p-2.5 rounded-xl border border-brand/20 space-y-1 animate-in fade-in duration-150">
                <label className="text-2xs font-bold text-brand-ink block">شركة الشحن للتوصيل:</label>
                <select
                  value={courierPartyId || ''}
                  onChange={(e) => onUpdateCourierPartyId?.(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2.5 py-1.5 bg-panel border border-line rounded-lg text-xs font-bold text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">-- اختر شركة الشحن --</option>
                  {couriers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Net Total Display */}
        <div className="p-3.5 bg-ink text-canvas rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-2xs text-muted block">المبلغ الإجمالي المطلوب:</span>
            <span className="text-xl sm:text-2xl font-black text-canvas tracking-tight">
              {formatCurrency(total)}
            </span>
          </div>

          <div className="text-left text-2xs text-muted">
            <span>شامل الضريبة</span>
          </div>
        </div>

        {/* Action Buttons: 56px Checkout Trigger and Accessible Hold Button */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={items.length === 0}
            onClick={onHoldCart}
            className="h-14 min-h-[56px] px-4 rounded-2xl flex items-center gap-1.5 shrink-0"
            title="تعليق الفاتورة مؤقتاً لخدمة عميل آخر"
          >
            <PauseCircle className="w-5 h-5 text-warn" />
            <span className="hidden sm:inline font-bold">تعليق (F4)</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            disabled={items.length === 0}
            onClick={onCheckout}
            className="flex-1 h-14 min-h-[56px] rounded-2xl text-sm sm:text-base font-black flex items-center justify-between px-5 shadow-md"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              <span>إتمام الدفع (F9)</span>
            </div>
            <span className="text-base font-black">
              {formatCurrency(total)}
            </span>
          </Button>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-line text-ink">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h4 className="text-sm font-black text-ink">إضافة عميل سريع</h4>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 text-muted hover:text-ink rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink">اسم العميل:</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="الاسم الثلاثي أو اسم المحل..."
                  className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-ink">رقم الهاتف (اختياري):</label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isAddingCust}
                  className="flex-1 rounded-xl text-xs font-black"
                >
                  {isAddingCust ? 'جاري الحفظ...' : 'حفظ واختيار العميل'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
