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
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Ticket Header & Customer Selector */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">سلة الفاتورة الحالية</h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {totalItemsCount} قطعة ({items.length} صنف)
              </span>
            </div>
          </div>

          {items.length > 0 && (
            <button
              onClick={onClearCart}
              title="إفراغ السلة"
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">مسح السلة</span>
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
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-700">السلة فارغة حالياً</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              انقر على أي منتج من الكتالوج أو استخدم قارئ الباركود للإضافة الفورية.
            </p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.product_id}_${item.product_variant_id || 0}_${item.product_batch_id || 0}_${item.unit_name || ''}_${index}`}
              className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
            >
              {/* Product Info & Badges */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-slate-800 truncate leading-tight">
                  {item.product_name}
                </h4>

                {/* Variant & Unit Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {item.variant_name && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                      {item.variant_name}
                    </span>
                  )}
                  {item.unit_name && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-bold border border-sky-100">
                      {item.unit_name}
                    </span>
                  )}
                  {item.batch_number && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                      تشغيلة: {item.batch_number}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </span>
                </div>
              </div>

              {/* Quantity Stepper Buttons */}
              <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                  className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                >
                  <Minus className="w-3 h-3" />
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
                  className="w-10 text-center font-mono font-black text-xs text-slate-900 border-none focus:outline-none p-0"
                />

                <button
                  type="button"
                  onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                  className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Line Total & Remove */}
              <div className="flex items-center gap-2 text-right">
                <span className="font-mono font-black text-xs text-emerald-700 min-w-[60px]">
                  {formatCurrency(item.total)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(index)}
                  className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ticket Footer (Totals & Actions) */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
        {/* Subtotal and Discount Row */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>المجموع الفرعي:</span>
            <span className="font-mono font-bold text-slate-700">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-slate-400" />
              <span>خصم الفاتورة:</span>
            </span>
            <div className="flex items-center gap-1 w-24">
              <input
                type="number"
                min="0"
                step="1"
                value={discount || ''}
                onChange={(e) => onUpdateDiscount(Number(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full text-left font-mono font-bold text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-rose-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
            </div>
          </div>

          {/* Courier & Shipping Section */}
          <div className="pt-1.5 space-y-2 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
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
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold text-xs flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span>شحن عبر شركة شحن</span>
                </span>
              </label>

              {(isShippingSelected || Boolean(shippingCost > 0 || courierPartyId)) && (
                <div className="flex items-center gap-1 w-24">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={shippingCost || ''}
                    onChange={(e) => onUpdateShippingCost?.(Number(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full text-left font-mono font-bold text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-indigo-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                </div>
              )}
            </div>

            {(isShippingSelected || Boolean(shippingCost > 0 || courierPartyId)) && (
              <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 space-y-1 animate-in fade-in duration-150">
                <label className="text-[11px] font-bold text-indigo-950 block">شركة الشحن للتوصيل:</label>
                <select
                  value={courierPartyId || ''}
                  onChange={(e) => onUpdateCourierPartyId?.(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-400 block">المبلغ الإجمالي المطلوب:</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {formatCurrency(total)}
            </span>
          </div>

          <div className="text-left text-[10px] text-slate-400 font-mono">
            <span>شامل الضريبة</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={items.length === 0}
            onClick={onHoldCart}
            className="p-3 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-xs"
            title="تعليق الفاتورة مؤقتاً لخدمة عميل آخر"
          >
            <PauseCircle className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">تعليق (F4)</span>
          </button>

          <button
            type="button"
            disabled={items.length === 0}
            onClick={onCheckout}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white py-3.5 rounded-2xl text-sm font-black shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>إتمام الدفع (F9)</span>
          </button>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-black text-slate-900">إضافة عميل سريع</h4>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">اسم العميل:</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="الاسم الثلاثي أو اسم المحل..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">رقم الهاتف (اختياري):</label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isAddingCust}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black transition-colors"
                >
                  {isAddingCust ? 'جاري الحفظ...' : 'حفظ واختيار العميل'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
