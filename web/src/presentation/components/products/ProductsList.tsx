import React from 'react';
import { PaginationBar } from '../common/PaginationBar';
import { ProductMobileCard } from '../mobile/ProductMobileCard';
import { formatCurrency, formatNumber } from '@pos-mandob/shared';
import { Package, AlertTriangle, Trash2, Edit2, Barcode, PlusCircle, RefreshCw } from 'lucide-react';
import type { ProductsViewModel } from './types';

export const ProductsList: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { search, page, setPage, setSelectedBatchProduct, setSelectedPrintProduct, syncingProductId, canAddProduct, canEditProduct, canDeleteProduct, canViewPurchasePrice, isLoading, handlePushStock, products, meta, openEditModal, handleDelete } = vm;

  return (
    <>
      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400 font-medium">جاري تحميل الأصناف...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">لا توجد أصناف مطابقة</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {search
                ? 'لم نجد أي صنف يطابق معايير البحث'
                : canAddProduct
                ? 'ابدأ بإضافة أول صنف أو استيراد الأصناف عبر Excel'
                : 'لا توجد أصناف مسجلة بالمتجر حالياً'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const hasExpiredBatch = p.batches?.some((b: any) => b.is_expired);
                    const hasNearExpiryBatch = p.batches?.some((b: any) => b.is_near_expiry && !b.is_expired);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Product Name & Type Tag */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{p.name}</span>
                            {p.has_variants && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                                {p.variants?.length ? `${p.variants.length} مقاس/لون` : 'متغيرات'}
                              </span>
                            )}
                            {p.has_expiry && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                صلاحية
                              </span>
                            )}
                          </div>
                          {p.category_name && (
                            <span className="text-xs text-slate-400 block mt-0.5">{p.category_name}</span>
                          )}
                          {p.has_variants && p.variants && p.variants.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              {p.variants.slice(0, 4).map((v: any, vi: number) => (
                                <span
                                  key={vi}
                                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60"
                                >
                                  {v.size || v.color || v.name}
                                </span>
                              ))}
                              {p.variants.length > 4 && (
                                <span className="text-[10px] text-indigo-600 font-bold">
                                  +{p.variants.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Barcode & Code */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {p.barcode ? (
                            <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                              <Barcode className="w-3.5 h-3.5" />
                              {p.barcode}
                            </span>
                          ) : (
                            p.code || '—'
                          )}
                        </td>

                        {/* Purchase Price (Cost) */}
                        {canViewPurchasePrice && (
                          <td className="py-3.5 px-4 text-slate-700 font-medium">
                            {p.purchase_price !== null && p.purchase_price !== undefined
                              ? formatCurrency(p.purchase_price)
                              : '—'}
                          </td>
                        )}

                        {/* Sale Price */}
                        <td className="py-3.5 px-4 text-emerald-700 font-bold">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{formatCurrency(p.sale_price)}</span>
                            {Boolean(p.regular_price && Number(p.regular_price) > Number(p.sale_price)) && (
                              <span className="line-through text-slate-400 text-xs font-normal font-mono">
                                {formatCurrency(Number(p.regular_price))}
                              </span>
                            )}
                          </div>
                          {Boolean(p.regular_price && Number(p.regular_price) > Number(p.sale_price)) && (
                            <span className="inline-block text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 mt-0.5">
                              خصم {Math.round(((Number(p.regular_price) - Number(p.sale_price)) / Number(p.regular_price)) * 100)}%
                            </span>
                          )}
                          {p.sub_unit && p.sub_unit_price && (
                            <span className="text-[11px] text-slate-400 block font-normal">
                              {formatCurrency(p.sub_unit_price)} / {p.sub_unit}
                            </span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-black px-2.5 py-0.5 rounded-full text-xs ${
                                p.is_low_stock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {formatNumber(p.quantity)} {p.unit || 'قطعة'}
                            </span>
                            {p.is_low_stock && (
                              <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
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
                              <div className="flex items-center gap-1.5">
                                {hasExpiredBatch ? (
                                  <span className="text-[11px] font-black px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md">
                                    يوجد تشغيلة منتهية
                                  </span>
                                ) : hasNearExpiryBatch ? (
                                  <span className="text-[11px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">
                                    قريب الانتهاء
                                  </span>
                                ) : p.batches?.length ? (
                                  <span className="text-[11px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                                    ساري ({p.batches.length} تشغيلات)
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">لا توجد تشغيلات</span>
                                )}

                                {/* Quick Add Batch Button */}
                                {canEditProduct && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedBatchProduct(p)}
                                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline inline-flex items-center gap-0.5"
                                    title="إضافة تشغيلة جديدة للمنتج"
                                  >
                                    <PlusCircle className="w-3 h-3" />
                                    <span>+ تشغيلة</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {p.sub_unit && (
                              <span className="text-[11px] px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md font-bold inline-block">
                                1 {p.sub_unit} = {p.sub_unit_factor} {p.unit || 'قطعة'}
                              </span>
                            )}

                            {!p.has_expiry && !p.sub_unit && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        {(canEditProduct || canDeleteProduct) && (
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Direct WooCommerce Stock Push */}
                              {Boolean((p as any).wc_product_id) && (
                                <button
                                  onClick={() => handlePushStock(p)}
                                  disabled={syncingProductId === p.id}
                                  className="p-1.5 text-purple-600 hover:text-purple-800 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer disabled:opacity-50"
                                  title="مزامنة الرصيد مع ووكومرس فورياً 🔄"
                                >
                                  <RefreshCw className={`w-4 h-4 ${syncingProductId === p.id ? 'animate-spin' : ''}`} />
                                </button>
                              )}

                              {/* Barcode Print Action */}
                              <button
                                onClick={() => setSelectedPrintProduct(p)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                                title="طباعة ملصقات الباركود 🏷️"
                              >
                                <Barcode className="w-4 h-4 text-indigo-600" />
                              </button>

                              {canEditProduct && (
                                <button
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="تعديل الصنف"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {canDeleteProduct && (
                                <button
                                  onClick={() => handleDelete(p)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="حذف الصنف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View (md:hidden) */}
            <div className="md:hidden space-y-3 p-3 bg-slate-50/60">
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

    </>
  );
};
