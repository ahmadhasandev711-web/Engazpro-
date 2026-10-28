import { useCallback, useRef } from 'react';
import { useBarcodeScanner } from './useBarcodeScanner';
import { ProductItem } from '../presentation/components/pos/PosProductCatalog';
import { VariantSelectionPayload } from '../presentation/components/products/ProductVariantModal';

export interface PosScanMatch {
  product: ProductItem;
  variantId: number | null;
}

interface UsePosBarcodeLookupProps {
  products: ProductItem[];
  lookupCode: (code: string) => Promise<PosScanMatch | null>;
  onAddToCart: (product: ProductItem) => void;
  onAddCustomSelection: (selection: VariantSelectionPayload) => void;
  onOpenVariantModal: (product: ProductItem) => void;
  onNotFound: (barcode: string) => void;
  onLookupError: () => void;
}

const matchesCode = (value: string | undefined | null, code: string): boolean => {
  return Boolean(value && value.toLowerCase() === code);
};

export const usePosBarcodeLookup = ({
  products,
  lookupCode,
  onAddToCart,
  onAddCustomSelection,
  onOpenVariantModal,
  onNotFound,
  onLookupError,
}: UsePosBarcodeLookupProps) => {
  const inflightRef = useRef(new Set<string>());

  const applyMatch = useCallback(
    (product: ProductItem, variantId: number | null, cleanCode: string) => {
      if (variantId) {
        const variant = product.variants?.find((item) => Number(item.id) === Number(variantId));
        if (variant) {
          onAddCustomSelection({
            product,
            variant,
            unit_name: product.unit || 'قطعة',
            unit_price: Number(variant.sale_price || product.sale_price || 0),
            quantity: 1,
          });
          return;
        }
      }

      const matchedVariant = product.variants?.find(
        (variant) => matchesCode(variant.barcode, cleanCode) || matchesCode(variant.code, cleanCode)
      );
      if (matchedVariant) {
        onAddCustomSelection({
          product,
          variant: matchedVariant,
          unit_name: product.unit || 'قطعة',
          unit_price: Number(matchedVariant.sale_price || product.sale_price || 0),
          quantity: 1,
        });
        return;
      }

      if (
        product.has_variants ||
        (product.variants && product.variants.length > 0) ||
        product.sub_unit ||
        product.has_expiry ||
        (product.batches && product.batches.length > 0)
      ) {
        onOpenVariantModal(product);
        return;
      }

      onAddToCart(product);
    },
    [onAddCustomSelection, onAddToCart, onOpenVariantModal]
  );

  const handleScanOrInputBarcode = useCallback(
    async (barcode: string): Promise<boolean> => {
      const cleanCode = barcode.trim().toLowerCase();
      if (!cleanCode || inflightRef.current.has(cleanCode)) return false;

      for (const product of products) {
        const matchedVariant = product.variants?.find(
          (variant) => matchesCode(variant.barcode, cleanCode) || matchesCode(variant.code, cleanCode)
        );
        if (matchedVariant) {
          applyMatch(product, matchedVariant.id, cleanCode);
          return true;
        }
      }

      const matched = products.find(
        (product) => matchesCode(product.code, cleanCode) || matchesCode(product.barcode, cleanCode)
      );
      if (matched) {
        applyMatch(matched, null, cleanCode);
        return true;
      }

      inflightRef.current.add(cleanCode);
      try {
        const found = await lookupCode(barcode.trim());
        if (!found) {
          onNotFound(barcode);
          return false;
        }
        applyMatch(found.product, found.variantId, cleanCode);
        return true;
      } catch {
        onLookupError();
        return false;
      } finally {
        inflightRef.current.delete(cleanCode);
      }
    },
    [products, lookupCode, applyMatch, onNotFound, onLookupError]
  );

  useBarcodeScanner({
    onScan: (barcode) => {
      void handleScanOrInputBarcode(barcode);
    },
  });

  return {
    handleScanOrInputBarcode,
  };
};
