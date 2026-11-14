import React from 'react';
import { PaginationBar } from '../common/PaginationBar';
import { ProductMobileCard } from '../mobile/ProductMobileCard';
import { formatCurrency, formatNumber } from '@pos-mandob/shared';
import { Package, AlertTriangle, Trash2, Edit2, Barcode, PlusCircle, RefreshCw } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { ProductsViewModel } from './types';

export const ProductsList: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const {
    search,
    page,
    setPage,
    setSelectedBatchProduct,
    setSelectedPrintProduct,
    syncingProductId,
    canAddProduct,
    canEditProduct,
    canDeleteProduct,
    canViewPurchasePrice,
    isLoading,
    handlePushStock,
    products,
    meta,
    openEditModal,
    handleDelete,
  } = vm;

  return (
    <div className="bg-panel rounded-2xl border border-line shadow-xs overflow-hidden transition-colors">
      {isLoading ? (
        <div className="text-center py-12 text-sm text-muted font-medium">جاري تحميل الأصناف...</div>
      ) : products.length === 0 ? (
        <EmptyState
          className="border-0 rounded-none"
          icon={<Package className="w-6 h-6 text-muted" />}
          title="لا توجد أصناف مطابقة"
          description={
            search
              ? 'لم نجد أي صنف يطابق معايير البحث'
              : canAddProduct
              ? 'ابدأ بإضافة أول صنف أو استيراد الأصناف عبر Excel'
              : 'لا توجد أصناف مسجلة بالمتجر حالياً'
          }
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <DataTable className="hidden md:block border-0 rounded-none shadow-none">
            <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
              <tr>
                <th className="py-3.5 px-4">الصنف والنوع</th>
                <th className="py-3.5 px-4">الباركود / الكود</th>
                {canViewPurchasePrice && <th className="py-3.5 px-4">سعر الشراء</th>}
                <th className="py-3.5 px-4">سعر البيع</th>
                <th className="py-3.5 px-4">الكمية والمخزون</th>
                <th className="py-3.5 px-4">حالة الصلاحية / الوحدة</th>
                {(canEditProduct || canDeleteProduct) && (
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => {
                const hasExpiredBatch = p.batches?.some((b: any) => b.is_expired);
                const hasNearExpiryBatch = p.batches?.some((b: any) => b.is_near_expiry && !b.is_expired);

                return (
                  <tr key={p.id} className="hover:bg-surface-2/50 transition-colors">
                    {/* Product Name & Type Tag */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink">{p.name}</span>
                        {p.has_variants && (
                          <Badge tone="brand" className="text-2xs px-2 py-0.5">
                            {p.variants?.length ? `${p.variants.length} مقاس/لون` : 'متغيرات'}
                          </Badge>
                        )}
                        {p.has_expiry && (
                          <Badge tone="ok" className="text-2xs px-2 py-0.5">
                            صلاحية
                          </Badge>
                        )}
                      </div>
                      {p.category_name && (
                        <span className="text-xs text-muted block mt-0.5">{p.category_name}</span>
                      )}
                      {p.has_variants && p.variants && p.variants.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {p.variants.slice(0, 4).map((v: any, vi: number) => (
                            <span
                              key={vi}
                              className="text-2xs tabular-nums px-1.5 py-0.5 rounded bg-surface-2 text-muted border border-line"
                            >
                              {v.size || v.color || v.name}
                            </span>
                          ))}
                          {p.variants.length > 4 && (
                            <span className="text-2xs text-brand font-bold tabular-nums">
                              +{p.variants.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Barcode & Code */}
                    <td className="py-3.5 px-4 text-muted tabular-nums text-xs">
                      {p.barcode ? (
                        <Badge tone="neutral" className="rounded-md px-2 py-0.5 font-medium tabular-nums">
                          <Barcode className="w-3.5 h-3.5" />
                          {p.barcode}
                        </Badge>
                      ) : (
                        p.code || '—'
                      )}
                    </td>

                    {/* Purchase Price (Cost) */}
                    {canViewPurchasePrice && (
                      <td className="py-3.5 px-4 text-ink font-medium tabular-nums">
                        {p.purchase_price !== null && p.purchase_price !== undefined
                          ? formatCurrency(p.purchase_price)
                          : '—'}
                      </td>
                    )}

                    {/* Sale Price */}
                    <td className="py-3.5 px-4 text-ok font-bold tabular-nums">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{formatCurrency(p.sale_price)}</span>
                        {Boolean(p.regular_price && Number(p.regular_price) > Number(p.sale_price)) && (
                          <span className="line-through text-muted text-xs font-normal tabular-nums">
                            {formatCurrency(Number(p.regular_price))}
                          </span>
                        )}
                      </div>
                      {Boolean(p.regular_price && Number(p.regular_price) > Number(p.sale_price)) && (
                        <Badge tone="bad" className="text-2xs rounded-md px-1.5 py-0.5 mt-0.5 tabular-nums">
                          خصم {Math.round(((Number(p.regular_price) - Number(p.sale_price)) / Number(p.regular_price)) * 100)}%
                        </Badge>
                      )}
                      {p.sub_unit && p.sub_unit_price && (
                        <span className="text-2xs text-muted block font-normal tabular-nums">
                          {formatCurrency(p.sub_unit_price)} / {p.sub_unit}
                        </span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={p.is_low_stock ? 'warn' : 'neutral'}
                          className="font-black tabular-nums"
                        >
                          {formatNumber(p.quantity)} {p.unit || 'قطعة'}
                        </Badge>
                        {p.is_low_stock && (
                          <span className="text-2xs font-bold text-warn flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            نواقص
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Expiry & Sub-Unit Status */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {p.has_expiry && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasExpiredBatch ? (
                              <Badge tone="bad" className="text-2xs rounded-md px-2 py-0.5 font-black">
                                يوجد تشغيلة منتهية
                              </Badge>
                            ) : hasNearExpiryBatch ? (
                              <Badge tone="warn" className="text-2xs rounded-md px-2 py-0.5 font-black">
                                قريب الانتهاء
                              </Badge>
                            ) : p.batches?.length ? (
                              <Badge tone="ok" className="text-2xs rounded-md px-2 py-0.5 font-black tabular-nums">
                                ساري ({p.batches.length} تشغيلات)
                              </Badge>
                            ) : (
                              <span className="text-2xs text-muted">لا توجد تشغيلات</span>
                            )}

                            {/* Quick Add Batch Button */}
                            {canEditProduct && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="md"
                                onClick={() => setSelectedBatchProduct(p)}
                                leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                                className="text-2xs font-bold text-ok px-2 hover:bg-ok-soft"
                                title="إضافة تشغيلة جديدة للمنتج"
                              >
                                + تشغيلة
                              </Button>
                            )}
                          </div>
                        )}

                        {p.sub_unit && (
                          <Badge tone="info" className="text-2xs rounded-md px-2 py-0.5 font-bold tabular-nums">
                            1 {p.sub_unit} = {p.sub_unit_factor} {p.unit || 'قطعة'}
                          </Badge>
                        )}

                        {!p.has_expiry && !p.sub_unit && (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    {(canEditProduct || canDeleteProduct) && (
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Direct WooCommerce Stock Push */}
                          {Boolean((p as any).wc_product_id) && (
                            <Button
                              variant="ghost"
                              size="md"
                              onClick={() => handlePushStock(p)}
                              disabled={syncingProductId === p.id}
                              className="min-w-[44px] px-0 text-brand hover:bg-brand-soft"
                              title="مزامنة الرصيد مع ووكومرس فورياً"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingProductId === p.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}

                          {/* Barcode Print Action */}
                          <Button
                            variant="ghost"
                            size="md"
                            onClick={() => setSelectedPrintProduct(p)}
                            className="min-w-[44px] px-0 text-brand hover:bg-brand-soft"
                            title="طباعة ملصقات الباركود"
                          >
                            <Barcode className="w-4 h-4" />
                          </Button>

                          {canEditProduct && (
                            <Button
                              variant="ghost"
                              size="md"
                              onClick={() => openEditModal(p)}
                              className="min-w-[44px] px-0 text-muted hover:text-brand hover:bg-brand-soft"
                              title="تعديل الصنف"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          {canDeleteProduct && (
                            <Button
                              variant="ghost"
                              size="md"
                              onClick={() => handleDelete(p)}
                              className="min-w-[44px] px-0 text-muted hover:text-bad hover:bg-bad-soft"
                              title="حذف الصنف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </DataTable>

          {/* Mobile Touch Cards View (md:hidden) */}
          <div className="md:hidden space-y-3 p-3 bg-surface-2/40">
            {products.map((p) => (
              <ProductMobileCard
                key={p.id}
                product={p}
                canViewPurchasePrice={canViewPurchasePrice}
                canEditProduct={canEditProduct}
                canDeleteProduct={canDeleteProduct}
                syncingProductId={syncingProductId}
                onPushStock={handlePushStock}
                onPrintBarcode={(prod) => setSelectedPrintProduct(prod)}
                onEditProduct={(prod) => openEditModal(prod)}
                onDeleteProduct={(prod) => handleDelete(prod)}
                onAddBatch={(prod) => setSelectedBatchProduct(prod)}
              />
            ))}
          </div>

          <PaginationBar
            currentPage={meta?.current_page || page}
            lastPage={meta?.last_page || 1}
            total={meta?.total || products.length}
            perPage={meta?.per_page || 20}
            onPageChange={(newPage) => setPage(newPage)}
            itemLabel="صنف"
          />
        </>
      )}
    </div>
  );
};
