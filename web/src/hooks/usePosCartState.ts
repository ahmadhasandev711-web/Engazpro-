import { useState, useCallback, useMemo } from 'react';
import { Money } from '@pos-mandob/shared';
import { PosCartItem } from './useHoldInvoices';
import { ProductItem } from '../presentation/components/pos/PosProductCatalog';
import { VariantSelectionPayload } from '../presentation/components/products/ProductVariantModal';

const lineTotal = (quantity: number, unitPrice: number): number =>
  Money.of(unitPrice).multiply(quantity).getAmount();

const sumAmounts = (amounts: number[]): number =>
  amounts.reduce((acc, amount) => Money.of(acc).add(amount).getAmount(), 0);

interface UsePosCartStateProps {
  onItemAdded?: (itemName: string) => void;
}

export const usePosCartState = ({ onItemAdded }: UsePosCartStateProps = {}) => {
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [courierPartyId, setCourierPartyId] = useState<number | null>(null);

  // Add standard catalog product to cart
  const addToCart = useCallback(
    (product: ProductItem) => {
      const cartKey = `${product.id}_0_0_${product.unit || ''}`;
      setCartItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) => (item.cart_item_key || `${item.product_id}_0_0_${item.unit_name || ''}`) === cartKey
        );
        if (existingIndex > -1) {
          const updated = [...prev];
          const current = updated[existingIndex];
          const newQty = current.quantity + 1;
          updated[existingIndex] = {
            ...current,
            quantity: newQty,
            total: lineTotal(newQty, current.unit_price),
          };
          return updated;
        } else {
          const unitPrice = Number(product.sale_price || 0);
          const newItem: PosCartItem = {
            cart_item_key: cartKey,
            product_id: product.id,
            product_name: product.name,
            product_code: product.code,
            unit_name: product.unit || 'قطعة',
            unit_price: unitPrice,
            quantity: 1,
            stock_quantity: product.quantity,
            total: lineTotal(1, unitPrice),
          };
          return [...prev, newItem];
        }
      });
      onItemAdded?.(product.name);
    },
    [onItemAdded]
  );

  // Add custom selection (variant / sub-unit / batch) to cart
  const addCustomSelectionToCart = useCallback(
    (selection: VariantSelectionPayload) => {
      const { product, variant, batch, unit_name, is_sub_unit, unit_price, quantity } = selection;
      const cartKey = `${product.id}_${variant?.id || 0}_${batch?.id || 0}_${unit_name || ''}`;

      setCartItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.cart_item_key === cartKey);
        if (existingIndex > -1) {
          const updated = [...prev];
          const current = updated[existingIndex];
          const newQty = current.quantity + quantity;
          updated[existingIndex] = {
            ...current,
            quantity: newQty,
            total: lineTotal(newQty, current.unit_price),
          };
          return updated;
        } else {
          const newItem: PosCartItem = {
            cart_item_key: cartKey,
            product_id: product.id,
            product_variant_id: variant?.id || null,
            product_batch_id: batch?.id || null,
            product_name: product.name,
            product_code: variant?.code || product.code,
            variant_name: variant ? variant.name : null,
            batch_number: batch ? batch.batch_number : null,
            expiry_date: batch ? batch.expiry_date : null,
            unit_name: unit_name || product.unit || 'قطعة',
            is_sub_unit: Boolean(is_sub_unit),
            unit_price: unit_price,
            quantity: quantity,
            stock_quantity: variant?.quantity ?? batch?.quantity ?? product.quantity,
            total: lineTotal(quantity, unit_price),
          };
          return [...prev, newItem];
        }
      });

      const label = `${product.name} ${variant ? `(${variant.name})` : ''}`;
      onItemAdded?.(label);
    },
    [onItemAdded]
  );

  // Update item quantity by index
  const updateQuantity = useCallback((index: number, newQty: number) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setCartItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            quantity: newQty,
            total: lineTotal(newQty, item.unit_price),
          };
        }
        return item;
      })
    );
  }, []);

  // Remove item from cart by index
  const removeItem = useCallback((index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setCartItems([]);
    setDiscount(0);
    setShippingCost(0);
    setCourierPartyId(null);
  }, []);

  // Load a held cart into active state
  const loadCart = useCallback(
    (items: PosCartItem[], newDiscount: number = 0, newShippingCost: number = 0, newCourierPartyId: number | null = null) => {
      setCartItems(items);
      setDiscount(newDiscount);
      setShippingCost(newShippingCost);
      setCourierPartyId(newCourierPartyId);
    },
    []
  );

  // Reset cart after checkout
  const resetCartAfterCheckout = useCallback(() => {
    setCartItems([]);
    setDiscount(0);
    setShippingCost(0);
    setCourierPartyId(null);
  }, []);

  // Computed totals
  const subtotal = useMemo(
    () => sumAmounts(cartItems.map((i) => i.total)),
    [cartItems]
  );

  const totalAmount = useMemo(() => {
    const net = Money.of(subtotal).subtract(discount).add(shippingCost || 0);
    return net.isNegative() ? 0 : net.getAmount();
  }, [subtotal, discount, shippingCost]);

  return {
    cartItems,
    discount,
    shippingCost,
    courierPartyId,
    subtotal,
    totalAmount,
    setDiscount,
    setShippingCost,
    setCourierPartyId,
    setCartItems,
    addToCart,
    addCustomSelectionToCart,
    updateQuantity,
    removeItem,
    clearCart,
    loadCart,
    resetCartAfterCheckout,
  };
};
