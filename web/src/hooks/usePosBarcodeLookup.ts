import { useCallback } from 'react';
import { useBarcodeScanner } from './useBarcodeScanner';
import { ProductItem } from '../presentation/components/pos/PosProductCatalog';
import { VariantSelectionPayload } from '../presentation/components/products/ProductVariantModal';

interface UsePosBarcodeLookupProps {
  products: ProductItem[];
  onAddToCart: (product: ProductItem) => void;
  onAddCustomSelection: (selection: VariantSelectionPayload) => void;
  onOpenVariantModal: (product: ProductItem) => void;
  onNotFound: (barcode: string) => void;
}

export const usePosBarcodeLookup = ({
  products,
  onAddToCart,
  onAddCustomSelection,
  onOpenVariantModal,
  onNotFound,
}: UsePosBarcodeLookupProps) => {
  const handleScanOrInputBarcode = useCallback(
    (barcode: string): boolean => {
      const cleanCode = barcode.trim().toLowerCase();
      if (!cleanCode) return false;

      // 1. Direct variant barcode match (Fast scan for variants/matrices)
      for (const p of products) {
        if (p.variants && p.variants.length > 0) {
          const matchedVariant = p.variants.find(
            (v: any) =>
              (v.barcode && v.barcode.toLowerCase() === cleanCode) ||
              (v.code && v.code.toLowerCase() === cleanCode)
          );
          if (matchedVariant) {
            onAddCustomSelection({
              product: p,
              variant: matchedVariant,
              unit_name: p.unit || 'قطعة',
              unit_price: Number(matchedVariant.sale_price || p.sale_price || 0),
              quantity: 1,
            });
            return true;
          }
        }
      }

      // 2. Direct product match
      const matched = products.find(
        (p) =>
          (p.code && p.code.toLowerCase() === cleanCode) ||
          (p.barcode && p.barcode.toLowerCase() === cleanCode)
      );

      if (matched) {
        if (matched.has_variants || (matched.variants && matched.variants.length > 0)) {
          onOpenVariantModal(matched);
        } else {
          onAddToCart(matched);
        }
        return true;
      }

      onNotFound(barcode);
      return false;
    },
    [products, onAddToCart, onAddCustomSelection, onOpenVariantModal, onNotFound]
  );

  // Wire up hardware scanner listener
  useBarcodeScanner({
    onScan: (barcode) => {
      handleScanOrInputBarcode(barcode);
    },
  });

  return {
    handleScanOrInputBarcode,
  };
};
