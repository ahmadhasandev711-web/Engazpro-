import React, { useEffect, useState } from 'react';
import { ImagePlus, Plus, Star, Trash2, X } from 'lucide-react';
import {
  EasyfyCategory,
  EasyfyProduct,
  EasyfyStockMode,
  SaveEasyfyProductVariantInput,
} from '@pos-mandob/shared';
import {
  useDeleteEasyfyProductImage,
  useSaveEasyfyProduct,
  useSetPrimaryEasyfyImage,
  useUploadEasyfyProductImage,
} from '../../../../hooks/useAdminEasyfy';
import { useToast } from '../../../context/ToastContext';
import { Badge, Button, Card, Input, Select, Textarea } from '../../ui';

interface EasyfyProductFormModalProps {
  product: EasyfyProduct | null;
  categories: EasyfyCategory[];
  onClose: () => void;
}

const createEmptyVariant = (): SaveEasyfyProductVariantInput => ({
  label: '',
  sku: '',
  cost_price: 0,
  selling_price: 0,
  compare_at_price: null,
  stock_quantity: 0,
  low_stock_threshold: 5,
  min_order_qty: 1,
  is_active: true,
  price_tiers: [],
});

export const EasyfyProductFormModal: React.FC<EasyfyProductFormModalProps> = ({
  product,
  categories,
  onClose,
}) => {
  const toast = useToast();
  const saveProductMutation = useSaveEasyfyProduct();
  const uploadImageMutation = useUploadEasyfyProductImage();
  const setPrimaryMutation = useSetPrimaryEasyfyImage();
  const deleteImageMutation = useDeleteEasyfyProductImage();

  const [savedProduct, setSavedProduct] = useState<EasyfyProduct | null>(product);
  const [name, setName] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [shortDesc, setShortDesc] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [stockMode, setStockMode] = useState<EasyfyStockMode>(EasyfyStockMode.TRACKED);
  const [leadTimeDays, setLeadTimeDays] = useState<string>('');
  const [minOrderQty, setMinOrderQty] = useState<string>('1');
  const [allowCustomNote, setAllowCustomNote] = useState<boolean>(false);
  const [customNoteLabel, setCustomNoteLabel] = useState<string>('');
  const [allowArtworkUpload, setAllowArtworkUpload] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [variants, setVariants] = useState<SaveEasyfyProductVariantInput[]>([createEmptyVariant()]);

  useEffect(() => {
    setSavedProduct(product);
    if (!product) {
      setName('');
      setCategoryId('');
      setShortDesc('');
      setDescription('');
      setStockMode(EasyfyStockMode.TRACKED);
      setLeadTimeDays('');
      setMinOrderQty('1');
      setAllowCustomNote(false);
      setCustomNoteLabel('');
      setAllowArtworkUpload(false);
      setIsActive(true);
      setIsFeatured(false);
      setVariants([createEmptyVariant()]);
      return;
    }
    setName(product.name);
    setCategoryId(product.category_id ? String(product.category_id) : '');
    setShortDesc(product.short_description ?? '');
    setDescription(product.description ?? '');
    setStockMode((product.stock_mode as EasyfyStockMode) || EasyfyStockMode.TRACKED);
    setLeadTimeDays(product.lead_time_days ? String(product.lead_time_days) : '');
    setMinOrderQty(String(product.min_order_qty ?? 1));
    setAllowCustomNote(Boolean(product.allow_custom_note));
    setCustomNoteLabel(product.custom_note_label ?? '');
    setAllowArtworkUpload(Boolean(product.allow_artwork_upload));
    setIsActive(Boolean(product.is_active));
    setIsFeatured(Boolean(product.is_featured));
    setVariants(
      (product.variants ?? []).length > 0
        ? product.variants!.map((v) => ({
            id: v.id,
            label: v.label,
            sku: v.sku ?? '',
            cost_price: v.cost_price ?? 0,
            selling_price: v.selling_price,
            compare_at_price: v.compare_at_price ?? null,
            stock_quantity: v.stock_quantity,
            low_stock_threshold: v.low_stock_threshold,
            min_order_qty: v.min_order_qty,
            is_active: v.is_active,
            price_tiers: (v.price_tiers ?? []).map((t) => ({
              min_qty: t.min_qty,
              unit_price: t.unit_price,
            })),
          }))
        : [createEmptyVariant()]
    );
  }, [product]);

  const updateVariant = (idx: number, patch: Partial<SaveEasyfyProductVariantInput>) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const addTier = (vIdx: number) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === vIdx
          ? { ...v, price_tiers: [...(v.price_tiers ?? []), { min_qty: 10, unit_price: v.selling_price || 0 }] }
          : v
      )
    );
  };

  const updateTier = (vIdx: number, tIdx: number, field: 'min_qty' | 'unit_price', val: number) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i !== vIdx
          ? v
          : {
              ...v,
              price_tiers: (v.price_tiers ?? []).map((t, j) => (j === tIdx ? { ...t, [field]: val } : t)),
            }
      )
    );
  };

  const removeTier = (vIdx: number, tIdx: number) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === vIdx ? { ...v, price_tiers: (v.price_tiers ?? []).filter((_, j) => j !== tIdx) } : v
      )
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم المنتج.');
      return;
    }
    if (variants.some((v) => !v.label.trim())) {
      toast.error('يرجى إدخال اسم/مقاس كل متغير.');
      return;
    }
    try {
      const result = await saveProductMutation.mutateAsync({
        id: savedProduct?.id,
        category_id: categoryId ? Number(categoryId) : null,
        name: name.trim(),
        short_description: shortDesc || null,
        description: description || null,
        stock_mode: stockMode,
        lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
        min_order_qty: Number(minOrderQty || 1),
        allow_custom_note: allowCustomNote,
        custom_note_label: customNoteLabel || null,
        allow_artwork_upload: allowArtworkUpload,
        is_active: isActive,
        is_featured: isFeatured,
        variants,
      });
      setSavedProduct(result);
      toast.success('تم حفظ المنتج بنجاح.');
      if (savedProduct?.id) {
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ المنتج');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !savedProduct?.id) return;
    try {
      const uploaded = await uploadImageMutation.mutateAsync({
        productId: savedProduct.id,
        file,
        isPrimary: !(savedProduct.images ?? []).length,
      });
      setSavedProduct((prev) =>
        prev ? { ...prev, images: [...(prev.images ?? []), uploaded] } : prev
      );
      toast.success('تم رفع صورة المنتج بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر رفع الصورة');
    } finally {
      e.target.value = '';
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    if (!savedProduct?.id) return;
    try {
      await setPrimaryMutation.mutateAsync({ productId: savedProduct.id, imageId });
      setSavedProduct((prev) =>
        prev
          ? {
              ...prev,
              images: (prev.images ?? []).map((img) => ({
                ...img,
                is_primary: img.id === imageId,
              })),
            }
          : prev
      );
      toast.success('تم تعيين الصورة الرئيسية.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تحديث الصورة الرئيسية');
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    try {
      await deleteImageMutation.mutateAsync(imageId);
      setSavedProduct((prev) =>
        prev ? { ...prev, images: (prev.images ?? []).filter((img) => img.id !== imageId) } : prev
      );
      toast.success('تم حذف الصورة.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حذف الصورة');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-panel border border-line rounded-2xl shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-panel border-b border-line px-5 py-4 flex items-center justify-between">
          <h2 className="font-black text-lg text-ink">
            {savedProduct ? `تعديل منتج: ${savedProduct.name}` : 'إضافة منتج جديد لمتجر Easyfy'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted hover:text-ink"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="اسم المنتج" required value={name} onChange={(e) => setName(e.target.value)} />
            <Select
              label="التصنيف"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: '', label: 'بدون تصنيف' },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
            <Select
              label="نظام المخزون"
              value={stockMode}
              onChange={(e) => setStockMode(e.target.value as EasyfyStockMode)}
              options={[
                { value: EasyfyStockMode.TRACKED, label: 'مخزون فعلي (يخصم تلقائياً)' },
                { value: EasyfyStockMode.UNLIMITED, label: 'متاح بدون مخزون (بيع مفتوح)' },
                { value: EasyfyStockMode.MADE_TO_ORDER, label: 'حسب الطلب والتصنيع/الطباعة' },
              ]}
            />
            <Input
              label="وصف مختصر"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
            />
            <Input
              type="number"
              min="1"
              label="الحد الأدنى للطلب"
              value={minOrderQty}
              onChange={(e) => setMinOrderQty(e.target.value)}
            />
            <Input
              type="number"
              min="1"
              label="مدة التجهيز بالأيام (لحسب الطلب)"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
            />
          </div>

          <Textarea
            label="تفاصيل ومواصفات المنتج الكاملة"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-canvas p-4 rounded-xl border border-line text-xs font-bold text-ink">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>مفعّل ويظهر للعملاء</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
              <span>منتج مميز بالرئيسية</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allowCustomNote} onChange={(e) => setAllowCustomNote(e.target.checked)} />
              <span>السماح بملاحظة مواصفات الطباعة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allowArtworkUpload} onChange={(e) => setAllowArtworkUpload(e.target.checked)} />
              <span>السماح برفع ملف اللوجو</span>
            </label>
          </div>

          {allowCustomNote && (
            <Input
              label="عنوان حقل المواصفات للعميل"
              placeholder="مثال: اكتب مقاس الكيس ولون الطباعة المطلوب"
              value={customNoteLabel}
              onChange={(e) => setCustomNoteLabel(e.target.value)}
            />
          )}

          {/* Variants & Wholesale Price Tiers */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-sm text-ink">المتغيرات والمقاسات وشرائح الجملة</h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setVariants((prev) => [...prev, createEmptyVariant()])}
              >
                إضافة مقاس / متغير
              </Button>
            </div>

            <div className="space-y-4">
              {variants.map((v, vIdx) => (
                <div key={v.id ?? `new-${vIdx}`} className="p-4 rounded-xl border border-line bg-canvas space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="brand">متغير #{vIdx + 1}</Badge>
                    {variants.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setVariants((prev) => prev.filter((_, i) => i !== vIdx))}
                        leftIcon={<Trash2 className="w-3.5 h-3.5 text-bad" />}
                      >
                        حذف
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Input
                      label="اسم المقاس / الباكيت"
                      required
                      placeholder="30x40 سم - باكيت 100"
                      value={v.label}
                      onChange={(e) => updateVariant(vIdx, { label: e.target.value })}
                    />
                    <Input
                      label="SKU"
                      value={v.sku ?? ''}
                      onChange={(e) => updateVariant(vIdx, { sku: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      label="تكلفتك (سري للأدمن)"
                      value={String(v.cost_price ?? 0)}
                      onChange={(e) => updateVariant(vIdx, { cost_price: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      label="سعر البيع (ج.م)"
                      value={String(v.selling_price)}
                      onChange={(e) => updateVariant(vIdx, { selling_price: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      label="السعر قبل الخصم (اختياري)"
                      value={v.compare_at_price ?? ''}
                      onChange={(e) =>
                        updateVariant(vIdx, {
                          compare_at_price: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                    {stockMode === EasyfyStockMode.TRACKED && (
                      <>
                        <Input
                          type="number"
                          min="0"
                          label="الرصيد الحالي"
                          value={String(v.stock_quantity ?? 0)}
                          onChange={(e) => updateVariant(vIdx, { stock_quantity: Number(e.target.value) })}
                        />
                        <Input
                          type="number"
                          min="0"
                          label="تنبيه نقص المخزون"
                          value={String(v.low_stock_threshold ?? 5)}
                          onChange={(e) =>
                            updateVariant(vIdx, { low_stock_threshold: Number(e.target.value) })
                          }
                        />
                      </>
                    )}
                    <Input
                      type="number"
                      min="1"
                      label="أقل كمية للمتغير"
                      value={String(v.min_order_qty ?? 1)}
                      onChange={(e) => updateVariant(vIdx, { min_order_qty: Number(e.target.value) })}
                    />
                  </div>

                  {/* Price Tiers */}
                  <div className="pt-2 border-t border-line space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-muted">شرائح أسعار الجملة حسب الكمية:</span>
                      <Button type="button" size="sm" variant="secondary" onClick={() => addTier(vIdx)}>
                        + شريحة جملة
                      </Button>
                    </div>
                    {(v.price_tiers ?? []).map((tier, tIdx) => (
                      <div key={tIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                        <Input
                          type="number"
                          min="2"
                          label="بدءاً من كمية"
                          value={String(tier.min_qty)}
                          onChange={(e) => updateTier(vIdx, tIdx, 'min_qty', Number(e.target.value))}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          label="سعر القطعة بالشريحة"
                          value={String(tier.unit_price)}
                          onChange={(e) => updateTier(vIdx, tIdx, 'unit_price', Number(e.target.value))}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTier(vIdx, tIdx)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5 text-bad" />}
                        >
                          حذف الشريحة
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Product Images Section */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-black text-sm text-ink">معرض صور المنتج</h3>
              {savedProduct?.id ? (
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-on-brand text-xs font-bold cursor-pointer hover:opacity-90">
                  <ImagePlus className="w-4 h-4" />
                  <span>{uploadImageMutation.isPending ? 'جاري الرفع...' : 'رفع صورة جديدة'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadImageMutation.isPending}
                  />
                </label>
              ) : (
                <span className="text-xs text-muted">احفظ المنتج أولاً ليتم فتح رفع الصور المتعددة.</span>
              )}
            </div>

            {(savedProduct?.images ?? []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {savedProduct!.images!.map((img) => (
                  <div key={img.id} className="p-2 rounded-xl border border-line bg-canvas space-y-2">
                    <img
                      src={img.image_path}
                      alt={savedProduct!.name}
                      className="w-full h-28 object-cover rounded-lg border border-line"
                    />
                    <div className="flex items-center justify-between gap-1">
                      {img.is_primary ? (
                        <Badge tone="ok">رئيسية</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetPrimary(img.id)}
                          leftIcon={<Star className="w-3.5 h-3.5" />}
                        >
                          رئيسية
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteImage(img.id)}
                        leftIcon={<Trash2 className="w-3.5 h-3.5 text-bad" />}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <Button type="button" variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
            <Button type="submit" isLoading={saveProductMutation.isPending}>
              {savedProduct?.id ? 'حفظ التعديلات' : 'إنشاء المنتج ومتابعة الصور'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
