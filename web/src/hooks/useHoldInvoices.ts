import { useState, useEffect } from 'react';

export interface PosCartItem {
  cart_item_key?: string;
  product_id: number;
  product_variant_id?: number | null;
  product_batch_id?: number | null;
  product_name: string;
  product_code: string;
  variant_name?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  unit_name?: string | null;
  is_sub_unit?: boolean;
  unit_price: number;
  quantity: number;
  stock_quantity?: number;
  total: number;
}

export interface HeldCart {
  id: string;
  createdAt: string;
  customer: {
    id: number | null;
    name: string;
  };
  items: PosCartItem[];
  discount: number;
  shipping_cost?: number;
  courier_party_id?: number | null;
  notes?: string;
  subtotal: number;
}

const STORAGE_KEY = 'cashat_pos_held_carts';

export const useHoldInvoices = () => {
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(heldCarts));
    } catch {
      // Ignore storage write errors
    }
  }, [heldCarts]);

  const holdCart = (cartData: Omit<HeldCart, 'id' | 'createdAt'>): HeldCart => {
    const newCart: HeldCart = {
      ...cartData,
      id: 'HOLD-' + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setHeldCarts((prev) => [newCart, ...prev]);
    return newCart;
  };

  const removeHeldCart = (id: string) => {
    setHeldCarts((prev) => prev.filter((c) => c.id !== id));
  };

  const clearAllHeldCarts = () => {
    setHeldCarts([]);
  };

  return {
    heldCarts,
    holdCart,
    removeHeldCart,
    clearAllHeldCarts,
  };
};
