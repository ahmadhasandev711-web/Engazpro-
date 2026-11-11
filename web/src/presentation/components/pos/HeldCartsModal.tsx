import React from 'react';
import { X, Play, Trash2, Clock, User, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { HeldCart } from '../../../hooks/useHoldInvoices';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

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
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-panel rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-line animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] text-ink">
        {/* Header */}
        <div className="p-5 bg-surface-1 border-b border-line text-ink flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-warn-soft text-warn rounded-xl border border-warn/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink">الفواتير المعلقة مؤقتاً</h3>
              <p className="text-[11px] text-muted">
                {heldCarts.length} فاتورة في الانتظار
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {heldCarts.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-8 h-8 text-muted" />}
              title="لا توجد فواتير معلقة حالياً"
              description="يمكنك تعليق أي فاتورة جارية بالضغط على زر تعليق في شاشة البيع."
              className="bg-transparent border-0 py-8"
            />
          ) : (
            heldCarts.map((cart) => (
              <div
                key={cart.id}
                className="p-4 bg-surface-1/60 border border-line rounded-2xl flex flex-col gap-3 hover:border-brand/40 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-line/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted bg-surface-2 px-2 py-0.5 rounded-md border border-line">
                      {cart.createdAt}
                    </span>
                    <span className="font-bold text-ink flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-muted" />
                      {cart.customer.name}
                    </span>
                  </div>
                  <span className="font-black text-brand">
                    {formatCurrency(cart.subtotal - cart.discount)}
                  </span>
                </div>

                <div className="text-[11px] text-muted">
                  <span className="font-bold text-ink">محتويات السلة:</span>{' '}
                  {cart.items.map((i) => `${i.product_name} (${i.quantity})`).join('، ')}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => onResumeCart(cart)}
                    className="flex-1 rounded-xl text-xs font-black min-h-[40px] flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>استرجاع الفاتورة للسلة</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => onDeleteCart(cart.id)}
                    className="p-2.5 min-h-[40px] min-w-[40px] text-muted hover:text-bad bg-panel border border-line hover:bg-bad-soft rounded-xl transition-colors flex items-center justify-center"
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
        <div className="p-3 bg-surface-1 border-t border-line">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="w-full rounded-xl text-xs font-bold min-h-[40px]"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};
