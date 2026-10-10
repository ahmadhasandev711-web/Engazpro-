import React from 'react';
import { X, Play, Trash2, Clock, User, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { HeldCart } from '../../../hooks/useHoldInvoices';

interface HeldCartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldCarts: HeldCart[];
  onResumeCart: (cart: HeldCart) => void;
  onDeleteCart: (id: string) => void;
}

export const HeldCartsModal: React.FC<HeldCartsModalProps> = ({
  isOpen,
  onClose,
  heldCarts,
  onResumeCart,
  onDeleteCart,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black">الفواتير المعلقة مؤقتاً</h3>
              <p className="text-[11px] text-slate-400">
                {heldCarts.length} فاتورة في الانتظار
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {heldCarts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">لا توجد فواتير معلقة حالياً</p>
              <p className="text-[11px] mt-1">
                يمكنك تعليق أي فاتورة جارية بالضغط على زر "تعليق" في شاشة البيع.
              </p>
            </div>
          ) : (
            heldCarts.map((cart) => (
              <div
                key={cart.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 hover:border-slate-300 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {cart.createdAt}
                    </span>
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {cart.customer.name}
                    </span>
                  </div>
                  <span className="font-mono font-black text-emerald-600">
                    {formatCurrency(cart.subtotal - cart.discount)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700">محتويات السلة:</span>{' '}
                  {cart.items.map((i) => `${i.product_name} (${i.quantity})`).join('، ')}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onResumeCart(cart)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>استرجاع الفاتورة للسلة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCart(cart.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 bg-white border border-slate-200 hover:bg-rose-50 rounded-xl transition-colors"
                    title="حذف الفاتورة المعلقة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
