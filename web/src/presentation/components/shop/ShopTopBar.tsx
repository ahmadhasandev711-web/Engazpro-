import React from 'react';
import { MessageCircle, Package, ShoppingBag, ShoppingCart } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { formatCurrency } from '@pos-mandob/shared';
import { useEasyfyCart, useEasyfyStorefront } from '../../../hooks/useEasyfyShop';
import { cn } from '../../utils/cn';
import { Badge } from '../ui';

export const ShopTopBar: React.FC = () => {
  const { data: storefront } = useEasyfyStorefront();
  const { data: cart } = useEasyfyCart();

  const itemsCount = cart?.items_count ?? 0;
  const subtotal = cart?.subtotal ?? 0;
  const whatsapp = storefront?.settings.support_whatsapp?.replace(/\D/g, '') || '';

  return (
    <div className="bg-panel border border-line rounded-2xl p-3 sm:px-5 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
      <div className="flex items-center gap-2 flex-wrap">
        <NavLink
          to="/shop"
          end
          className={({ isActive }) =>
            cn(
              'min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors',
              isActive
                ? 'bg-brand text-on-brand shadow-xs'
                : 'text-ink bg-surface-2 hover:bg-brand-soft hover:text-brand-ink'
            )
          }
        >
          <ShoppingBag className="w-4 h-4" />
          <span>كتالوج المستلزمات</span>
        </NavLink>

        <NavLink
          to="/shop/orders"
          className={({ isActive }) =>
            cn(
              'min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors',
              isActive
                ? 'bg-brand text-on-brand shadow-xs'
                : 'text-ink bg-surface-2 hover:bg-brand-soft hover:text-brand-ink'
            )
          }
        >
          <Package className="w-4 h-4" />
          <span>طلبات المتجر</span>
        </NavLink>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-3 py-2 rounded-xl border border-line bg-canvas hover:border-ok text-xs font-bold text-ink inline-flex items-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-ok" />
            <span className="hidden sm:inline">دعم التوريدات</span>
          </a>
        )}

        <NavLink
          to="/shop/cart"
          className={({ isActive }) =>
            cn(
              'min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-black inline-flex items-center gap-2 border transition-colors',
              isActive
                ? 'bg-brand text-on-brand border-brand'
                : 'bg-brand-soft text-brand-ink border-brand/25 hover:bg-brand hover:text-on-brand'
            )
          }
        >
          <ShoppingCart className="w-4 h-4" />
          <span>السلة</span>
          <Badge tone={itemsCount > 0 ? 'brand' : 'neutral'} className="tabular-nums">
            {itemsCount}
          </Badge>
          {subtotal > 0 && (
            <span className="hidden sm:inline text-xs font-black tabular-nums">
              • {formatCurrency(subtotal)}
            </span>
          )}
        </NavLink>
      </div>
    </div>
  );
};
