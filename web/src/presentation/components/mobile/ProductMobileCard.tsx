import React, { useState } from 'react';
import {
  Barcode,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  PlusCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
} from 'lucide-react';
import { Product, formatCurrency, formatNumber } from '@pos-mandob/shared';
import { Badge, Button, Card } from '../ui';
import { useHaptic } from '../../hooks/useHaptic';

interface ProductMobileCardProps {
  product: Product;
  canViewPurchasePrice: boolean;
  canEditProduct: boolean;
  canDeleteProduct: boolean;
  syncingProductId: number | null;
  onPushStock: (product: Product) => void;
  onPrintBarcode: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onAddBatch?: (product: Product) => void;
}

/**
 * Presentation Layer - ProductMobileCard
 * Mobile-first card for catalog & inventory items.
 * Adheres strictly to GR-0 (Cost Privacy Guard) & Touch Ergonomics (GR-5).
 */
export const ProductMobileCard: React.FC<ProductMobileCardProps> = ({
  product,
  canViewPurchasePrice,
  canEditProduct,
  canDeleteProduct,
  syncingProductId,
  onPushStock,
  onPrintBarcode,
  onEditProduct,
  onDeleteProduct,
  onAddBatch,
}) => {
  const { selection } = useHaptic();
  const [showVariants, setShowVariants] = useState(false);

  const hasExpiredBatch = product.batches?.some((b: any) => b.is_expired);
  const hasNearExpiryBatch = product.batches?.some((b: any) => b.is_near_expiry && !b.is_expired);
  const isOutOfStock = product.quantity <= 0;
  const isSyncing = syncingProductId === product.id;
  const isWcConnected = Boolean((product as any).wc_product_id);

  // Status color stripe
  let statusColor: 'rose' | 'amber' | 'emerald' = 'emerald';
  if (hasExpiredBatch || isOutOfStock) {
    statusColor = 'rose';
  } else if (product.is_low_stock || hasNearExpiryBatch) {
    statusColor = 'amber';
  }

  const stripeClass =
    statusColor === 'rose'
      ? 'border-r-4 border-r-bad'
      : statusColor === 'amber'
      ? 'border-r-4 border-r-warn'
      : 'border-r-4 border-r-ok';

  return (
    <Card className={`p-4 sm:p-4 space-y-3 ${stripeClass}`}>
      {/* 1. Header: Name, Badges & Sale Price */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-black text-ink text-sm leading-tight break-words">
              {product.name}
            </h4>

            {product.has_variants && (
              <Badge tone="info" className="text-2xs shrink-0">
                {product.variants?.length ? `${product.variants.length} مقاس/لون` : 'متغيرات'}
              </Badge>
            )}

            {product.has_expiry && (
              <Badge tone="ok" className="text-2xs shrink-0">
                صلاحية
              </Badge>
            )}

            {isWcConnected && (
              <Badge tone="brand" className="text-2xs shrink-0 gap-0.5">
                <Globe className="w-2.5 h-2.5" />
                ووكومرس
              </Badge>
            )}
          </div>

          {product.category_name && (
            <span className="text-xs text-muted font-medium block mt-0.5 truncate">
              {product.category_name}
            </span>
          )}
        </div>

        {/* Pricing Box */}
        <div className="text-left shrink-0">
          <span className="font-black text-ok text-base tabular-nums block leading-none">
            {formatCurrency(product.sale_price)}
          </span>
          {product.sub_unit_price && product.sub_unit && (
            <span className="text-2xs text-muted block tabular-nums mt-0.5">
              {formatCurrency(product.sub_unit_price)} / {product.sub_unit}
            </span>
          )}
          {canViewPurchasePrice && product.purchase_price !== null && product.purchase_price !== undefined && (
            <span className="text-2xs text-muted font-bold block mt-0.5">
              التكلفة: <span className="tabular-nums text-ink">{formatCurrency(product.purchase_price)}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Stock and Barcode Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-surface-2/80 rounded-xl border border-line text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted font-medium">الرصيد:</span>
          <Badge
            tone={isOutOfStock ? 'bad' : product.is_low_stock ? 'warn' : 'ok'}
            className="rounded-lg text-xs font-black tabular-nums"
          >
            {formatNumber(product.quantity)} {product.unit || 'قطعة'}
          </Badge>

          {product.is_low_stock && (
            <Badge tone="warn" className="rounded-md text-2xs font-black gap-0.5 px-1.5">
              <AlertTriangle className="w-3 h-3" /> نواقص
            </Badge>
          )}
        </div>

        {product.barcode ? (
          <span className="tabular-nums text-2xs font-bold text-ink bg-panel px-2 py-0.5 rounded-md border border-line shadow-2xs inline-flex items-center gap-1">
            <Barcode className="w-3 h-3 text-muted" />
            {product.barcode}
          </span>
        ) : product.code ? (
          <span className="tabular-nums text-2xs text-muted bg-panel px-1.5 py-0.5 rounded border border-line">
            {product.code}
          </span>
        ) : null}
      </div>

      {/* 3. Sub-unit Conversion Note */}
      {product.sub_unit && (
        <div className="text-2xs text-info bg-info-soft border border-info/25 px-2.5 py-1 rounded-lg font-bold tabular-nums">
          1 {product.sub_unit} = {product.sub_unit_factor} {product.unit || 'قطعة'}
        </div>
      )}

      {/* 4. Expiry Batch Details */}
      {product.has_expiry && (
        <div className="flex items-center justify-between text-xs pt-0.5">
          {hasExpiredBatch ? (
            <Badge tone="bad" className="rounded-md text-2xs font-black">
              ⚠️ توجد تشغيلة منتهية الصلاحية
            </Badge>
          ) : hasNearExpiryBatch ? (
            <Badge tone="warn" className="rounded-md text-2xs font-black">
              ⚠️ توجد تشغيلة قريبة الانتهاء
            </Badge>
          ) : (
            <span className="text-2xs font-bold text-ok tabular-nums">
              ساري ({product.batches?.length || 0} تشغيلات)
            </span>
          )}

          {canEditProduct && onAddBatch && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                selection();
                onAddBatch(product);
              }}
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              className="text-2xs font-bold text-ok bg-ok-soft hover:bg-ok/15 border-ok/25 px-3"
            >
              <span>+ تشغيلة</span>
            </Button>
          )}
        </div>
      )}

      {/* 5. Expandable Variants Matrix (Accordion) */}
      {product.has_variants && product.variants && product.variants.length > 0 && (
        <div className="border border-line rounded-xl overflow-hidden bg-surface-2/50">
          <button
            type="button"
            onClick={() => {
              selection();
              setShowVariants(!showVariants);
            }}
            className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-xs font-bold text-ink hover:bg-surface-2 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-ink" />
              المتغيرات ({product.variants.length} مقاس ولون)
            </span>
            {showVariants ? (
              <ChevronUp className="w-4 h-4 text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted" />
            )}
          </button>

          {showVariants && (
            <div className="p-2 space-y-1.5 border-t border-line bg-panel">
              {product.variants.map((v: any, vi: number) => (
                <div
                  key={v.id || vi}
                  className="flex items-center justify-between p-1.5 bg-surface-2 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-ink">
                      {v.size || v.color || v.name}
                    </span>
                    {v.color && v.size && (
                      <span className="text-2xs text-muted">({v.color})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-muted bg-panel px-1.5 py-0.5 rounded border border-line text-2xs">
                      الرصيد: {formatNumber(v.quantity || 0)}
                    </span>
                    <span className="tabular-nums font-bold text-ok text-2xs">
                      {formatCurrency(v.sale_price || product.sale_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Quick Action Buttons Row (Touch Targets >= 44px) */}
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-line">
        {/* WooCommerce Live Push */}
        {isWcConnected && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              selection();
              onPushStock(product);
            }}
            disabled={isSyncing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
            className="px-3 text-xs text-brand-ink bg-brand-soft hover:bg-brand-soft/80 border-brand/25"
            title="مزامنة المخزون مع ووكومرس فورياً"
          >
            <span>ووكومرس</span>
          </Button>
        )}

        {/* Barcode Print */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            selection();
            onPrintBarcode(product);
          }}
          leftIcon={<Barcode className="w-3.5 h-3.5" />}
          className="px-3 text-xs text-info bg-info-soft hover:bg-info/15 border-info/25"
          title="طباعة ملصقات الباركود"
        >
          <span>باركود</span>
        </Button>

        {/* Edit Product */}
        {canEditProduct && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              selection();
              onEditProduct(product);
            }}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
            className="px-3 text-xs"
            title="تعديل بيانات الصنف"
          >
            <span>تعديل</span>
          </Button>
        )}

        {/* Delete Product */}
        {canDeleteProduct && (
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => {
              selection();
              onDeleteProduct(product);
            }}
            className="min-w-[44px] px-3 text-bad bg-bad-soft hover:bg-bad/15 border border-bad/25"
            title="حذف الصنف"
            aria-label="حذف الصنف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
};
