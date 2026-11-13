import React from 'react';
import { VariantMatrixGenerator } from './VariantMatrixGenerator';
import { Package, X, Layers, Calendar, Tag } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { cn } from '../../utils/cn';
import type { ProductsViewModel } from './types';

export const ProductFormModal: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const {
    isModalOpen,
    setIsModalOpen,
    editingProduct,
    productType,
    setProductType,
    hasSubUnit,
    setHasSubUnit,
    variants,
    setVariants,
    batchData,
    setBatchData,
    canViewPurchasePrice,
    register,
    handleSubmit,
    watch,
    errors,
    saveMutation,
    onSubmit,
  } = vm;

  return (
    <>
      {/* Add / Edit Modal - Responsive Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-canvas/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150 overflow-y-auto" dir="rtl">
          <div className="bg-panel rounded-t-[2.5rem] sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-line space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center font-black border border-brand/20">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink">
                    {editingProduct ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
                  </h3>
                  <p className="text-xs text-muted">حدد نوع الصنف وإعدادات الوحدات والمتغيرات</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[44px] px-0 text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Product Type Selector */}
              {!editingProduct && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink">نوع الصنف (طبيعة النشاط):</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setProductType('STANDARD')}
                      className={cn(
                        'min-h-[44px] p-3 rounded-2xl border text-center transition-all cursor-pointer',
                        productType === 'STANDARD'
                          ? 'border-brand bg-brand-soft ring-2 ring-brand/20 text-brand-ink font-bold'
                          : 'border-line bg-panel hover:bg-surface-2 text-muted'
                      )}
                    >
                      <Tag className="w-4 h-4 mx-auto mb-1 text-brand" />
                      <span className="text-xs font-black block text-ink">صنف قياسي</span>
                      <span className="text-2xs text-muted block">سوبر ماركت / عام</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductType('VARIABLE')}
                      className={cn(
                        'min-h-[44px] p-3 rounded-2xl border text-center transition-all cursor-pointer',
                        productType === 'VARIABLE'
                          ? 'border-brand bg-brand-soft ring-2 ring-brand/20 text-brand-ink font-bold'
                          : 'border-line bg-panel hover:bg-surface-2 text-muted'
                      )}
                    >
                      <Layers className="w-4 h-4 mx-auto mb-1 text-brand" />
                      <span className="text-xs font-black block text-ink">متغيرات ومقاسات</span>
                      <span className="text-2xs text-muted block">ملابس وأحذية</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductType('EXPIRY')}
                      className={cn(
                        'min-h-[44px] p-3 rounded-2xl border text-center transition-all cursor-pointer',
                        productType === 'EXPIRY'
                          ? 'border-ok bg-ok-soft ring-2 ring-ok/20 text-ok font-bold'
                          : 'border-line bg-panel hover:bg-surface-2 text-muted'
                      )}
                    >
                      <Calendar className="w-4 h-4 mx-auto mb-1 text-ok" />
                      <span className="text-xs font-black block text-ink">تاريخ صلاحية</span>
                      <span className="text-2xs text-muted block">أغذية / صيدلية</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Basic Fields */}
              <Input
                {...register('name')}
                label="اسم الصنف *"
                type="text"
                placeholder="مثال: قميص أكسفورد قطن / حليب كامل الدسم"
                error={errors.name?.message}
                className="bg-surface-2/50"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  {...register('barcode')}
                  label="الباركود الرئيسي"
                  type="text"
                  placeholder="622xxxxxxx"
                  className="bg-surface-2/50 tabular-nums"
                />
                <Input
                  {...register('code')}
                  label="الكود الداخلي"
                  type="text"
                  placeholder="PRD-001"
                  className="bg-surface-2/50 tabular-nums"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  {...register('purchase_price')}
                  label="سعر الشراء (التكلفة) *"
                  type="number"
                  step="0.01"
                  error={errors.purchase_price?.message}
                  className="bg-surface-2/50 tabular-nums"
                />
                <Input
                  {...register('regular_price')}
                  label="سعر البيع الأساسي (قبل الخصم)"
                  type="number"
                  step="0.01"
                  placeholder="اختياري (سعر القائمة)"
                  error={errors.regular_price?.message}
                  className="bg-surface-2/50 tabular-nums"
                />
                <Input
                  {...register('sale_price')}
                  label="سعر البيع الفعلي / المخفض *"
                  type="number"
                  step="0.01"
                  error={errors.sale_price?.message}
                  className="bg-surface-2/50 font-bold text-ok tabular-nums"
                />
              </div>

              {/* Standard product quantity and min quantity */}
              {productType === 'STANDARD' && (
                <div className="grid grid-cols-2 gap-3">
                  {!editingProduct && (
                    <Input
                      {...register('quantity')}
                      label="الرصيد الافتتاحي بالمخزن"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      className="bg-surface-2/50 tabular-nums"
                    />
                  )}
                  <Input
                    {...register('min_quantity')}
                    label="حد الطلب (تنبيه النواقص)"
                    type="number"
                    step="0.01"
                    placeholder="مثال: 5"
                    className="bg-surface-2/50 tabular-nums"
                  />
                </div>
              )}

              {/* Unit of Measurement */}
              <Input
                {...register('unit')}
                label="الوحدة الأساسية"
                type="text"
                placeholder="قطعة / لتر / كجم / متر"
                className="bg-surface-2/50"
              />

              {/* Multi-Unit Section (Sub-Unit / Carton) */}
              <div className="p-4 bg-surface-2 border border-line rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable_sub_unit"
                      checked={hasSubUnit}
                      onChange={(e) => setHasSubUnit(e.target.checked)}
                      className="w-4 h-4 accent-brand rounded-lg focus:ring-brand"
                    />
                    <label htmlFor="enable_sub_unit" className="text-xs font-black text-ink cursor-pointer">
                      تفعيل وحدة تعبئة فرعية (مثل: كرتونة / باكتة / دستة)
                    </label>
                  </div>
                </div>

                {hasSubUnit && (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-line animate-in fade-in duration-150">
                    <div>
                      <label className="block text-2xs font-bold text-muted mb-1">اسم الوحدة الفرعية</label>
                      <input
                        {...register('sub_unit')}
                        type="text"
                        placeholder="كرتونة"
                        className="w-full min-h-[40px] px-2.5 py-1.5 bg-panel text-ink border border-line rounded-xl text-xs text-right focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-muted mb-1">معامل التحويل (عدد الوحدات)</label>
                      <input
                        {...register('sub_unit_factor')}
                        type="number"
                        step="0.01"
                        placeholder="مثال: 24"
                        className="w-full min-h-[40px] px-2.5 py-1.5 bg-panel text-ink border border-line rounded-xl text-xs text-right tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-muted mb-1">سعر بيع الوحدة الفرعية</label>
                      <input
                        {...register('sub_unit_price')}
                        type="number"
                        step="0.01"
                        placeholder="350"
                        className="w-full min-h-[40px] px-2.5 py-1.5 bg-panel text-ink border border-line rounded-xl text-xs text-right tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Variable Matrix Section (Clothing / Shoes) */}
              {productType === 'VARIABLE' && (
                <div className="p-4 bg-brand-soft/60 border border-brand/20 rounded-3xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-ink">مصفوفة المقاسات والألوان الذكية (المتغيرات)</h4>
                      <p className="text-xs text-muted mt-0.5">
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
                <div className="p-4 bg-ok-soft/60 border border-ok/20 rounded-2xl space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-ink">بيانات التشغيلة الافتتاحية (Batch)</h4>
                    <p className="text-2xs text-muted">أدخل رقم التشغيلة وتاريخ انتهاء الصلاحية للرصيد الحالي</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-bold text-ink mb-1">رقم التشغيلة *</label>
                      <input
                        type="text"
                        value={batchData.batch_number}
                        onChange={(e) => setBatchData({ ...batchData, batch_number: e.target.value })}
                        placeholder="LOT-2026-001"
                        className="w-full min-h-[40px] px-3 py-1.5 bg-panel text-ink border border-line rounded-xl text-xs tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-ink mb-1">تاريخ انتهاء الصلاحية *</label>
                      <input
                        type="date"
                        value={batchData.expiry_date}
                        onChange={(e) => setBatchData({ ...batchData, expiry_date: e.target.value })}
                        className="w-full min-h-[40px] px-3 py-1.5 bg-panel text-ink border border-line rounded-xl text-xs tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-bold text-ink mb-1">تاريخ الإنتاج (اختياري)</label>
                      <input
                        type="date"
                        value={batchData.production_date}
                        onChange={(e) => setBatchData({ ...batchData, production_date: e.target.value })}
                        className="w-full min-h-[40px] px-3 py-1.5 bg-panel text-ink border border-line rounded-xl text-xs tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-ink mb-1">الرصيد الافتتاحي للتشغيلة</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={batchData.quantity}
                        onChange={(e) => setBatchData({ ...batchData, quantity: Number(e.target.value) })}
                        className="w-full min-h-[40px] px-3 py-1.5 bg-panel text-ink border border-line rounded-xl text-xs tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Textarea
                {...register('notes')}
                label="ملاحظات إضافية"
                rows={2}
                className="bg-surface-2/50"
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={saveMutation.isPending}
                  isLoading={saveMutation.isPending}
                  className="text-xs font-bold"
                >
                  {saveMutation.isPending ? 'جاري الحفظ...' : editingProduct ? 'حفظ التعديلات' : 'إضافة الصنف'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
