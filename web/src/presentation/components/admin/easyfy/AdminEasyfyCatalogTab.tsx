import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  FolderOpen,
  ImagePlus,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { EasyfyCategory, EasyfyProduct, EasyfyStockMode, formatCurrency } from '@pos-mandob/shared';
import {
  useAdminEasyfyCategories,
  useAdminEasyfyProducts,
  useDeleteEasyfyCategory,
  useDeleteEasyfyProduct,
  useSaveEasyfyCategory,
  useUploadEasyfyCategoryImage,
} from '../../../../hooks/useAdminEasyfy';
import { useConfirm } from '../../../context/ConfirmContext';
import { useToast } from '../../../context/ToastContext';
import { Badge, Button, Card, DataTable, EmptyState, Input, Select } from '../../ui';
import { EasyfyProductFormModal } from './EasyfyProductFormModal';
import { STOCK_MODE_META } from './easyfyUiMeta';

export const AdminEasyfyCatalogTab: React.FC = () => {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [subTab, setSubTab] = useState<'products' | 'categories'>('products');
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [stockMode, setStockMode] = useState<EasyfyStockMode | ''>('');
  const [page, setPage] = useState<number>(1);
  const [editingProduct, setEditingProduct] = useState<EasyfyProduct | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);

  const [catEditingId, setCatEditingId] = useState<number | undefined>(undefined);
  const [catName, setCatName] = useState<string>('');
  const [catDesc, setCatDesc] = useState<string>('');
  const [catSort, setCatSort] = useState<string>('0');
  const [catActive, setCatActive] = useState<boolean>(true);

  const { data: categories = [] } = useAdminEasyfyCategories();
  const { data: productsPage, isLoading } = useAdminEasyfyProducts({
    category_id: categoryId ? Number(categoryId) : '',
    stock_mode: stockMode,
    search,
    page,
  });

  const deleteProductMutation = useDeleteEasyfyProduct();
  const saveCategoryMutation = useSaveEasyfyCategory();
  const uploadCatImageMutation = useUploadEasyfyCategoryImage();
  const deleteCategoryMutation = useDeleteEasyfyCategory();

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product: EasyfyProduct) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (product: EasyfyProduct) => {
    const ok = await confirm({
      title: 'حذف منتج',
      message: `هل تريد حذف المنتج "${product.name}" من الكتالوج؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteProductMutation.mutateAsync(product.id);
      toast.success('تم حذف المنتج بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حذف المنتج');
    }
  };

  const resetCategoryForm = () => {
    setCatEditingId(undefined);
    setCatName('');
    setCatDesc('');
    setCatSort('0');
    setCatActive(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      toast.error('يرجى إدخال اسم التصنيف.');
      return;
    }
    try {
      await saveCategoryMutation.mutateAsync({
        id: catEditingId,
        name: catName.trim(),
        description: catDesc || null,
        sort_order: Number(catSort || 0),
        is_active: catActive,
      });
      resetCategoryForm();
      toast.success('تم حفظ التصنيف بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ التصنيف');
    }
  };

  const handleCategoryImageUpload = async (catId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadCatImageMutation.mutateAsync({ categoryId: catId, file });
      toast.success('تم رفع صورة التصنيف بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر رفع صورة التصنيف');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteCategory = async (cat: EasyfyCategory) => {
    const ok = await confirm({
      title: 'حذف تصنيف',
      message: `هل تريد حذف التصنيف "${cat.name}"؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCategoryMutation.mutateAsync(cat.id);
      toast.success('تم حذف التصنيف بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حذف التصنيف');
    }
  };

  const products = productsPage?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={subTab === 'products' ? 'primary' : 'secondary'}
            leftIcon={<Package className="w-4 h-4" />}
            onClick={() => setSubTab('products')}
          >
            المنتجات ({productsPage?.total ?? 0})
          </Button>
          <Button
            size="sm"
            variant={subTab === 'categories' ? 'primary' : 'secondary'}
            leftIcon={<FolderOpen className="w-4 h-4" />}
            onClick={() => setSubTab('categories')}
          >
            الأقسام ({categories.length})
          </Button>
        </div>

        {subTab === 'products' && (
          <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={handleOpenNewProduct}>
            إضافة منتج جديد
          </Button>
        )}
      </div>

      {subTab === 'products' ? (
        <>
          <Card className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="بحث باسم المنتج أو الكود..."
              leftIcon={<Search className="w-4 h-4" />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'كل التصنيفات' },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
            <Select
              value={stockMode}
              onChange={(e) => {
                setStockMode(e.target.value as EasyfyStockMode | '');
                setPage(1);
              }}
              options={[
                { value: '', label: 'كل أنظمة المخزون' },
                { value: EasyfyStockMode.TRACKED, label: 'مخزون فعلي' },
                { value: EasyfyStockMode.UNLIMITED, label: 'متاح بدون مخزون' },
                { value: EasyfyStockMode.MADE_TO_ORDER, label: 'حسب الطلب' },
              ]}
            />
          </Card>

          {isLoading ? (
            <Card className="p-6">
              <div className="h-44 rounded-xl bg-surface-2 animate-pulse" />
            </Card>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package className="w-8 h-8 text-muted" />}
              title="لا توجد منتجات في كتالوج Easyfy بعد"
              description="ابدأ بإضافة أول منتج مستلزمات شحن أو تغليف مع متغيراته وأسعاره."
            />
          ) : (
            <DataTable>
              <thead className="bg-surface-2 text-xs text-muted font-extrabold">
                <tr>
                  <th className="px-4 py-3">المنتج</th>
                  <th className="px-4 py-3">التصنيف</th>
                  <th className="px-4 py-3">نظام المخزون</th>
                  <th className="px-4 py-3">المتغيرات والأسعار</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((product) => {
                  const primaryImg =
                    product.images?.find((i) => i.is_primary)?.image_path ||
                    product.images?.[0]?.image_path;
                  const modeMeta = STOCK_MODE_META[product.stock_mode] ?? {
                    label: String(product.stock_mode),
                    tone: 'neutral' as const,
                  };
                  const firstVar = product.variants?.[0];
                  return (
                    <tr key={product.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {primaryImg ? (
                            <img
                              src={primaryImg}
                              alt={product.name}
                              className="w-11 h-11 rounded-lg object-cover border border-line shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-surface-2 border border-line flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-muted" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-ink">{product.name}</p>
                            {product.is_featured && <Badge tone="brand">مميز</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {product.category?.name || 'غير مصنف'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <p className="font-bold text-ink">
                          {product.variants?.length ?? 0} متغيرات
                          {firstVar ? ` • بدءاً من ${formatCurrency(firstVar.selling_price)}` : ''}
                        </p>
                        {firstVar && firstVar.cost_price !== undefined && (
                          <p className="text-[11px] text-muted">
                            التكلفة: {formatCurrency(firstVar.cost_price)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={product.is_active ? 'ok' : 'neutral'}>
                          {product.is_active ? 'نشط' : 'مخفي'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                            onClick={() => handleEditProduct(product)}
                          >
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteProduct(product)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-bad" />}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}

          {productsPage && productsPage.last_page > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronRight className="w-4 h-4" />}
              >
                السابق
              </Button>
              <span className="text-xs font-bold text-muted">
                صفحة {productsPage.current_page} من {productsPage.last_page}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= productsPage.last_page}
                onClick={() => setPage((p) => p + 1)}
                rightIcon={<ChevronLeft className="w-4 h-4" />}
              >
                التالي
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-4 space-y-4">
            <h3 className="font-black text-sm text-ink">
              {catEditingId ? 'تعديل قسم' : 'إضافة قسم جديد'}
            </h3>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <Input
                label="اسم القسم"
                required
                placeholder="كراتين الشحن"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
              <Input
                label="وصف مختصر"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                label="ترتيب العرض"
                value={catSort}
                onChange={(e) => setCatSort(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={catActive} onChange={(e) => setCatActive(e.target.checked)} />
                <span>قسم مفعل</span>
              </label>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" isLoading={saveCategoryMutation.isPending}>
                  {catEditingId ? 'حفظ التعديل' : 'إضافة القسم'}
                </Button>
                {catEditingId && (
                  <Button type="button" size="sm" variant="secondary" onClick={resetCategoryForm}>
                    إلغاء
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <div className="lg:col-span-2">
            <DataTable>
              <thead className="bg-surface-2 text-xs text-muted font-extrabold">
                <tr>
                  <th className="px-4 py-3">القسم</th>
                  <th className="px-4 py-3">المنتجات</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {cat.image_path && (
                          <img
                            src={cat.image_path}
                            alt={cat.name}
                            className="w-9 h-9 rounded-lg object-cover border border-line"
                          />
                        )}
                        <div>
                          <p className="font-bold text-ink">{cat.name}</p>
                          {cat.description && <p className="text-[11px] text-muted">{cat.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-ink">
                      {cat.products_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={cat.is_active ? 'ok' : 'neutral'}>
                        {cat.is_active ? 'نشط' : 'مخفي'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <label className="cursor-pointer p-1.5 rounded-lg border border-line hover:bg-surface-2 text-brand" title="رفع صورة">
                          <ImagePlus className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => handleCategoryImageUpload(cat.id, e)}
                          />
                        </label>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setCatEditingId(cat.id);
                            setCatName(cat.name);
                            setCatDesc(cat.description ?? '');
                            setCatSort(String(cat.sort_order ?? 0));
                            setCatActive(cat.is_active);
                          }}
                        >
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(cat)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5 text-bad" />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {isProductModalOpen && (
        <EasyfyProductFormModal
          product={editingProduct}
          categories={categories}
          onClose={() => setIsProductModalOpen(false)}
        />
      )}
    </div>
  );
};
