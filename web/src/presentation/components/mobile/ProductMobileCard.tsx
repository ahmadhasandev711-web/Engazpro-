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
import { MobileCard } from './MobileCard';
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

  return (
    <MobileCard statusColor={statusColor} className="space-y-3">
      {/* 1. Header: Name, Badges & Sale Price */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-black text-slate-900 text-sm leading-tight break-words">
              {product.name}
            </h4>

            {product.has_variants && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shrink-0">
                {product.variants?.length ? `${product.variants.length} مقاس/لون` : 'متغيرات'}
              </span>
            )}

            {product.has_expiry && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shrink-0">
                صلاحية
              </span>
            )}

            {isWcConnected && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200 shrink-0 inline-flex items-center gap-0.5">
                <Globe className="w-2.5 h-2.5" />
                ووكومرس
              </span>
            )}
          </div>

          {product.category_name && (
            <span className="text-xs text-slate-400 font-medium block mt-0.5 truncate">
              {product.category_name}
            </span>
          )}
        </div>

        {/* Pricing Box */}
        <div className="text-left shrink-0">
          <span className="font-black text-emerald-600 text-base font-mono block leading-none">
            {formatCurrency(product.sale_price)}
          </span>
          {product.sub_unit_price && product.sub_unit && (
            <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
              {formatCurrency(product.sub_unit_price)} / {product.sub_unit}
            </span>
          )}
          {canViewPurchasePrice && product.purchase_price !== null && product.purchase_price !== undefined && (
            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
              التكلفة: <span className="font-mono text-slate-700">{formatCurrency(product.purchase_price)}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Stock and Barcode Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">الرصيد:</span>
          <span
            className={`font-black px-2 py-0.5 rounded-lg text-xs font-mono ${
              isOutOfStock
                ? 'bg-rose-100 text-rose-800'
                : product.is_low_stock
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {formatNumber(product.quantity)} {product.unit || 'قطعة'}
          </span>

          {product.is_low_stock && (
            <span className="text-[10px] font-black text-amber-600 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
              <AlertTriangle className="w-3 h-3" /> نواقص
            </span>
          )}
        </div>

        {product.barcode ? (
          <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs inline-flex items-center gap-1">
            <Barcode className="w-3 h-3 text-slate-400" />
            {product.barcode}
          </span>
        ) : product.code ? (
          <span className="font-mono text-[11px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            {product.code}
          </span>
        ) : null}
      </div>

      {/* 3. Sub-unit Conversion Note */}
      {product.sub_unit && (
        <div className="text-[11px] text-sky-800 bg-sky-50/70 border border-sky-100 px-2.5 py-1 rounded-lg font-bold">
          1 {product.sub_unit} = {product.sub_unit_factor} {product.unit || 'قطعة'}
        </div>
      )}

      {/* 4. Expiry Batch Details */}
      {product.has_expiry && (
        <div className="flex items-center justify-between text-xs pt-0.5">
          {hasExpiredBatch ? (
            <span className="text-[11px] font-black px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md">
              ⚠️ توجد تشغيلة منتهية الصلاحية
            </span>
          ) : hasNearExpiryBatch ? (
            <span className="text-[11px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">
              ⚠️ توجد تشغيلة قريبة الانتهاء
            </span>
          ) : (
            <span className="text-[11px] font-bold text-emerald-700">
              ساري ({product.batches?.length || 0} تشغيلات)
            </span>
          )}

          {canEditProduct && onAddBatch && (
            <button
              type="button"
              onClick={() => {
                selection();
                onAddBatch(product);
              }}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 active:scale-95 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 cursor-pointer"
            >
              <PlusCircle className="w-3 h-3" />
              <span>+ تشغيلة</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Expandable Variants Matrix (Accordion) */}
      {product.has_variants && product.variants && product.variants.length > 0 && (
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              selection();
              setShowVariants(!showVariants);
            }}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              المتغيرات ({product.variants.length} مقاس ولون)
            </span>
            {showVariants ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showVariants && (
            <div className="p-2 space-y-1.5 border-t border-slate-200/70 bg-white">
              {product.variants.map((v: any, vi: number) => (
                <div
                  key={v.id || vi}
                  className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">
                      {v.size || v.color || v.name}
                    </span>
                    {v.color && v.size && (
                      <span className="text-[10px] text-slate-400">({v.color})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                      الرصيد: {formatNumber(v.quantity || 0)}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 text-[11px]">
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
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
        {/* WooCommerce Live Push */}
        {isWcConnected && (
          <button
            type="button"
            onClick={() => {
              selection();
              onPushStock(product);
            }}
            disabled={isSyncing}
            className="min-h-[42px] px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 rounded-xl flex items-center gap-1.5 border border-purple-200 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="مزامنة المخزون مع ووكومرس فورياً"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>ووكومرس</span>
          </button>
        )}

        {/* Barcode Print */}
        <button
          type="button"
          onClick={() => {
            selection();
            onPrintBarcode(product);
          }}
          className="min-h-[42px] px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 rounded-xl flex items-center gap-1.5 border border-indigo-200 transition-all active:scale-95 cursor-pointer"
          title="طباعة ملصقات الباركود"
        >
          <Barcode className="w-3.5 h-3.5" />
          <span>باركود</span>
        </button>

        {/* Edit Product */}
        {canEditProduct && (
          <button
            type="button"
            onClick={() => {
              selection();
              onEditProduct(product);
            }}
            className="min-h-[42px] px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95 cursor-pointer"
            title="تعديل بيانات الصنف"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>تعديل</span>
          </button>
        )}

        {/* Delete Product */}
        {canDeleteProduct && (
          <button
            type="button"
            onClick={() => {
              selection();
              onDeleteProduct(product);
            }}
            className="min-h-[42px] px-2.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl flex items-center gap-1 border border-rose-200 transition-all active:scale-95 cursor-pointer"
            title="حذف الصنف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </MobileCard>
  );
};
