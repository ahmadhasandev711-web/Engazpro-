import React from 'react';
import { VariantMatrixGenerator } from './VariantMatrixGenerator';
import { Package, X, Layers, Calendar, Tag } from 'lucide-react';
import type { ProductsViewModel } from './types';

export const ProductFormModal: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { isModalOpen, setIsModalOpen, editingProduct, productType, setProductType, hasSubUnit, setHasSubUnit, variants, setVariants, batchData, setBatchData, canViewPurchasePrice, register, handleSubmit, watch, errors, saveMutation, onSubmit } = vm;

  return (
    <>
      {/* Add / Edit Modal - Responsive Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-black">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {editingProduct ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
                  </h3>
                  <p className="text-xs text-slate-400">حدد نوع الصنف وإعدادات الوحدات والمتغيرات</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Product Type Selector */}
              {!editingProduct && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">نوع الصنف (طبيعة النشاط):</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setProductType('STANDARD')}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        productType === 'STANDARD'
                          ? 'border-primary-600 bg-primary-50/60 ring-2 ring-primary-500/20 text-primary-900 font-bold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Tag className="w-4 h-4 mx-auto mb-1 text-primary-600" />
                      <span className="text-xs font-black block">صنف قياسي</span>
                      <span className="text-[10px] text-slate-400 block">سوبر ماركت / عام</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductType('VARIABLE')}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        productType === 'VARIABLE'
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 text-indigo-900 font-bold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Layers className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                      <span className="text-xs font-black block">متغيرات ومقاسات</span>
                      <span className="text-[10px] text-slate-400 block">ملابس وأحذية</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductType('EXPIRY')}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        productType === 'EXPIRY'
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Calendar className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                      <span className="text-xs font-black block">تاريخ صلاحية</span>
                      <span className="text-[10px] text-slate-400 block">أغذية / صيدلية</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Basic Fields */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف *</label>
                <input
                  {...register('name')}
                  type="text"
                  placeholder="مثال: قميص أكسفورد قطن / حليب كامل الدسم"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الباركود الرئيسي</label>
                  <input
                    {...register('barcode')}
                    type="text"
                    placeholder="622xxxxxxx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكود الداخلي</label>
                  <input
                    {...register('code')}
                    type="text"
                    placeholder="PRD-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر الشراء (التكلفة) *</label>
                  <input
                    {...register('purchase_price')}
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right font-mono"
                  />
                  {errors.purchase_price && (
                    <p className="text-xs text-rose-600 mt-1">{errors.purchase_price.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع الأساسي (قبل الخصم)</label>
                  <input
                    {...register('regular_price')}
                    type="number"
                    step="0.01"
                    placeholder="اختياري (سعر القائمة)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right font-mono"
                  />
                  {errors.regular_price && (
                    <p className="text-xs text-rose-600 mt-1">{errors.regular_price.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع الفعلي / المخفض *</label>
                  <input
                    {...register('sale_price')}
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right font-bold text-emerald-700 font-mono"
                  />
                  {errors.sale_price && (
                    <p className="text-xs text-rose-600 mt-1">{errors.sale_price.message}</p>
                  )}
                </div>
              </div>

              {/* Standard product quantity and min quantity */}
              {productType === 'STANDARD' && (
                <div className="grid grid-cols-2 gap-3">
                  {!editingProduct && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الافتتاحي بالمخزن</label>
                      <input
                        {...register('quantity')}
                        type="number"
                        step="0.01"
                        placeholder="0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">حد الطلب (تنبيه النواقص)</label>
                    <input
                      {...register('min_quantity')}
                      type="number"
                      step="0.01"
                      placeholder="مثال: 5"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                    />
                  </div>
                </div>
              )}

              {/* Unit of Measurement */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة الأساسية</label>
                <input
                  {...register('unit')}
                  type="text"
                  placeholder="قطعة / لتر / كجم / متر"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                />
              </div>

              {/* Multi-Unit Section (Sub-Unit / Carton) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable_sub_unit"
                      checked={hasSubUnit}
                      onChange={(e) => setHasSubUnit(e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded-lg focus:ring-primary-500"
                    />
                    <label htmlFor="enable_sub_unit" className="text-xs font-black text-slate-800 cursor-pointer">
                      تفعيل وحدة تعبئة فرعية (مثل: كرتونة / باكتة / دستة)
                    </label>
                  </div>
                </div>

                {hasSubUnit && (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم الوحدة الفرعية</label>
                      <input
                        {...register('sub_unit')}
                        type="text"
                        placeholder="كرتونة"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">معامل التحويل (عدد الوحدات)</label>
                      <input
                        {...register('sub_unit_factor')}
                        type="number"
                        step="0.01"
                        placeholder="مثال: 24"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">سعر بيع الوحدة الفرعية</label>
                      <input
                        {...register('sub_unit_price')}
                        type="number"
                        step="0.01"
                        placeholder="350"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-right"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Variable Matrix Section (Clothing / Shoes) */}
              {productType === 'VARIABLE' && (
                <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-3xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-indigo-950">مصفوفة المقاسات والألوان الذكية (المتغيرات)</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        اختر الألوان والمقاسات لتوليد كافة التوافيق والباركودات المخصصة بضغطة زر
                      </p>
                    </div>
                  </div>

                  <VariantMatrixGenerator
                    variants={variants}
                    onChange={setVariants}
                    baseSalePrice={Number(watch('sale_price') || 0)}
                    basePurchasePrice={Number(watch('purchase_price') || 0)}
                    productCode={watch('code') || ''}
                    isEditing={Boolean(editingProduct)}
                    canViewPurchasePrice={canViewPurchasePrice}
                  />
                </div>
              )}

              {/* Expiry / Batch Initial Fields for New Product */}
              {productType === 'EXPIRY' && !editingProduct && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-emerald-950">بيانات التشغيلة الافتتاحية (Batch)</h4>
                    <p className="text-[11px] text-slate-500">أدخل رقم التشغيلة وتاريخ انتهاء الصلاحية للرصيد الحالي</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم التشغيلة *</label>
                      <input
                        type="text"
                        value={batchData.batch_number}
                        onChange={(e) => setBatchData({ ...batchData, batch_number: e.target.value })}
                        placeholder="LOT-2026-001"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ انتهاء الصلاحية *</label>
                      <input
                        type="date"
                        value={batchData.expiry_date}
                        onChange={(e) => setBatchData({ ...batchData, expiry_date: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الإنتاج (اختياري)</label>
                      <input
                        type="date"
                        value={batchData.production_date}
                        onChange={(e) => setBatchData({ ...batchData, production_date: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">الرصيد الافتتاحي للتشغيلة</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={batchData.quantity}
                        onChange={(e) => setBatchData({ ...batchData, quantity: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition-colors"
                >
                  {saveMutation.isPending ? 'جاري الحفظ...' : editingProduct ? 'حفظ التعديلات' : 'إضافة الصنف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
};
