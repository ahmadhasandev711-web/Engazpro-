import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  Barcode,
  Download,
  Upload,
  Layers,
  Calendar,
  Clock,
  PlusCircle,
  Tag,
  Boxes,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { Product, ProductSchema, ProductInput, formatCurrency, formatNumber } from '@pos-mandob/shared';
import { exportProductsToExcel } from '../utils/excelExport';
import { usePermissions } from '../../hooks/usePermissions';
import { AddBatchModal } from '../components/products/AddBatchModal';
import { VariantMatrixGenerator } from '../components/products/VariantMatrixGenerator';
import { BarcodePrintModal } from '../components/products/BarcodePrintModal';
import { OpeningStockModal } from '../components/products/OpeningStockModal';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    isMandob,
    canAddProduct,
    canEditProduct,
    canDeleteProduct,
    canImportProducts,
    canViewPurchasePrice,
  } = usePermissions();

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'VARIABLE' | 'EXPIRY' | 'NEAR_EXPIRY' | 'LOW_STOCK'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedBatchProduct, setSelectedBatchProduct] = useState<Product | null>(null);
  const [selectedPrintProduct, setSelectedPrintProduct] = useState<Product | null>(null);
  const [isOpeningStockOpen, setIsOpeningStockOpen] = useState(false);
  const [syncingProductId, setSyncingProductId] = useState<number | null>(null);

  const handlePushStock = async (product: Product) => {
    setSyncingProductId(product.id);
    try {
      const res = await apiClient.post(`/woocommerce/products/${product.id}/push-stock`);
      setSuccessMessage(res.data?.message || 'تم تحديث رصيد الصنف في ووكومرس فورياً 🟢');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'فشلت مزامنة الرصيد مع ووكومرس');
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setSyncingProductId(null);
    }
  };

  // Variant & Batch Modal States
  const [productType, setProductType] = useState<'STANDARD' | 'VARIABLE' | 'EXPIRY'>('STANDARD');
  const [hasSubUnit, setHasSubUnit] = useState<boolean>(false);
  const [variants, setVariants] = useState<Array<{
    id?: number;
    name: string;
    color?: string | null;
    size?: string | null;
    barcode?: string | null;
    code?: string | null;
    sale_price?: number | null;
    purchase_price?: number | null;
    quantity?: number;
    min_quantity?: number | null;
  }>>([]);

  const [batchData, setBatchData] = useState<{
    batch_number: string;
    expiry_date: string;
    production_date: string;
    quantity: number;
    purchase_price?: number;
    sale_price?: number;
  }>({
    batch_number: '',
    expiry_date: '',
    production_date: '',
    quantity: 0,
  });

  // Fetch Products
  const { data, isLoading } = useQuery({
    queryKey: ['products', search, filterTab],
    queryFn: async () => {
      const params: any = {
        search: search || undefined,
      };
      if (filterTab === 'VARIABLE') params.type = 'VARIABLE';
      if (filterTab === 'EXPIRY') params.type = 'EXPIRY';
      if (filterTab === 'NEAR_EXPIRY') params.near_expiry = 1;
      if (filterTab === 'LOW_STOCK') params.low_stock = 1;

      const res = await apiClient.get('/products', { params });
      return res.data;
    },
  });

  const products: Product[] = data?.data || [];

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      purchase_price: 0,
      sale_price: 0,
      quantity: 0,
    },
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setProductType('STANDARD');
    setHasSubUnit(false);
    setVariants([]);
    setBatchData({
      batch_number: 'LOT-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      expiry_date: '',
      production_date: '',
      quantity: 0,
    });

    reset({
      name: '',
      code: '',
      barcode: '',
      purchase_price: 0,
      regular_price: null,
      sale_price: 0,
      min_sale_price: null,
      quantity: 0,
      min_quantity: 5,
      unit: 'قطعة',
      sub_unit: '',
      sub_unit_factor: null,
      sub_unit_price: null,
      notes: '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    const type = (p.type as any) || (p.has_variants ? 'VARIABLE' : p.has_expiry ? 'EXPIRY' : 'STANDARD');
    setProductType(type);
    setHasSubUnit(Boolean(p.sub_unit));
    setVariants(p.variants || []);

    setValue('name', p.name);
    setValue('code', p.code || '');
    setValue('barcode', p.barcode || '');
    setValue('purchase_price', p.purchase_price ?? 0);
    setValue('regular_price', p.regular_price || null);
    setValue('sale_price', p.sale_price);
    setValue('min_sale_price', p.min_sale_price || null);
    setValue('quantity', p.quantity);
    setValue('min_quantity', p.min_quantity || null);
    setValue('unit', p.unit || 'قطعة');
    setValue('sub_unit', p.sub_unit || '');
    setValue('sub_unit_factor', p.sub_unit_factor || null);
    setValue('sub_unit_price', p.sub_unit_price || null);
    setValue('notes', p.notes || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  // Save Mutation (Create or Update)
  const saveMutation = useMutation({
    mutationFn: async (input: ProductInput) => {
      const payload: any = {
        ...input,
        type: productType,
        has_variants: productType === 'VARIABLE',
        has_expiry: productType === 'EXPIRY',
      };

      if (hasSubUnit) {
        payload.sub_unit = input.sub_unit;
        payload.sub_unit_factor = input.sub_unit_factor;
        payload.sub_unit_price = input.sub_unit_price;
      } else {
        payload.sub_unit = null;
        payload.sub_unit_factor = null;
        payload.sub_unit_price = null;
      }

      if (productType === 'VARIABLE') {
        payload.variants = variants;
      } else if (productType === 'EXPIRY' && !editingProduct && batchData.expiry_date) {
        payload.batches = [
          {
            ...batchData,
            purchase_price: input.purchase_price,
            sale_price: input.sale_price,
          },
        ];
      }

      if (editingProduct) {
        return apiClient.put(`/products/${editingProduct.id}`, payload);
      } else {
        return apiClient.post('/products', payload);
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      setSuccessMessage(res.data.message || 'تم حفظ الصنف بنجاح');
      setTimeout(() => setSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر حفظ الصنف');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSuccessMessage('تم حذف الصنف بنجاح');
      setTimeout(() => setSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر حذف الصنف');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const onSubmit = (formData: ProductInput) => {
    saveMutation.mutate(formData);
  };

  const handleDelete = (p: Product) => {
    if (window.confirm(`هل أنت متأكد من حذف الصنف "${p.name}"؟`)) {
      deleteMutation.mutate(p.id);
    }
  };

  const totalProducts = products.length;
  const totalStock = products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
  const lowStockCount = products.filter((p) => p.is_low_stock).length;

  return (
    <div className="space-y-3 sm:space-y-6" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون المتقدم'}
          </h2>
          <p className="text-sm text-slate-500">
            {isMandob
              ? 'استعراض المنتجات، أسعار البيع، والكميات المتوفرة بالمخزن'
              : 'إدارة المنتجات، المقاسات والألوان، تواريخ الصلاحية، والوحدات المتعددة'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportProductsToExcel(products)}
            disabled={products.length === 0}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            title="تصدير الأصناف والمخزون الحالي إلى Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            تصدير Excel
          </button>
          {canImportProducts && (
            <button
              onClick={() => navigate('/excel')}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
              title="استيراد أصناف من ملف Excel"
            >
              <Upload className="w-4 h-4 text-primary-600" />
              استيراد Excel
            </button>
          )}
          {canAddProduct && (
            <button
              onClick={() => setIsOpeningStockOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
              title="إدخال رصيد أول المدة للأصناف والمتغيرات بدون فواتير"
            >
              <Boxes className="w-4 h-4 text-primary-600" />
              رصيد أول المدة
            </button>
          )}
          {canAddProduct && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة صنف جديد
            </button>
          )}
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">
                {isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون'}
              </h2>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                {totalProducts}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              المخزون: <span className="font-bold text-slate-800">{formatNumber(totalStock)}</span>
              {lowStockCount > 0 && (
                <span className="text-amber-600 font-black mr-1.5 inline-flex items-center gap-0.5">
                  • {lowStockCount} نواقص
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canAddProduct && (
            <button
              onClick={() => setIsOpeningStockOpen(true)}
              className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
              title="رصيد أول المدة"
            >
              <Boxes className="w-3.5 h-3.5 text-primary-600" />
              <span>أول المدة</span>
            </button>
          )}
          {canAddProduct && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1 bg-primary-600 active:bg-primary-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 sm:p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 sm:p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs Filter Bar (Horizontal Scroll Track) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar scroll-smooth flex-nowrap">
        <button
          onClick={() => setFilterTab('ALL')}
          className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs ${
            filterTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          الكل ({totalProducts})
        </button>
        <button
          onClick={() => setFilterTab('VARIABLE')}
          className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5 ${
            filterTab === 'VARIABLE'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>متغيرات</span>
        </button>
        <button
          onClick={() => setFilterTab('EXPIRY')}
          className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5 ${
            filterTab === 'EXPIRY'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>صلاحيات</span>
        </button>
        <button
          onClick={() => setFilterTab('NEAR_EXPIRY')}
          className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5 ${
            filterTab === 'NEAR_EXPIRY'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>قرب الانتهاء</span>
        </button>
        <button
          onClick={() => setFilterTab('LOW_STOCK')}
          className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5 ${
            filterTab === 'LOW_STOCK'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>نواقص ({lowStockCount})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="البحث بالاسم أو الباركود أو الكود أو المتغير..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-9 sm:pr-10 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-right"
          />
        </div>
      </div>

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
            <div className="md:hidden divide-y divide-slate-100">
              {products.map((p) => {
                const hasExpiredBatch = p.batches?.some((b: any) => b.is_expired);
                const hasNearExpiryBatch = p.batches?.some((b: any) => b.is_near_expiry && !b.is_expired);

                return (
                  <div key={p.id} className="p-4 space-y-3 bg-white">
                    {/* Header: Name + Sale Price */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
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
                      </div>
                      <div className="text-left shrink-0">
                        <span className="font-black text-emerald-600 text-base font-mono">
                          {formatCurrency(p.sale_price)}
                        </span>
                        {p.sub_unit_price && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {formatCurrency(p.sub_unit_price)} / {p.sub_unit}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock status and details pill */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">الرصيد:</span>
                        <span
                          className={`font-black px-2 py-0.5 rounded-lg text-xs ${
                            p.is_low_stock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {formatNumber(p.quantity)} {p.unit || 'قطعة'}
                        </span>
                        {p.is_low_stock && (
                          <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" /> نواقص
                          </span>
                        )}
                      </div>

                      {p.barcode && (
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {p.barcode}
                        </span>
                      )}
                    </div>

                    {/* Expiry alerts & variants snapshot */}
                    {p.has_expiry && (
                      <div className="text-xs flex items-center justify-between">
                        {hasExpiredBatch ? (
                          <span className="text-[11px] font-black px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md">
                            ⚠️ تشغيلة منتهية الصلاحية
                          </span>
                        ) : hasNearExpiryBatch ? (
                          <span className="text-[11px] font-black px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">
                            ⚠️ تشغيلة قريبة الانتهاء
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-700">
                            ساري ({p.batches?.length || 0} تشغيلات)
                          </span>
                        )}
                        {canEditProduct && (
                          <button
                            type="button"
                            onClick={() => setSelectedBatchProduct(p)}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-0.5"
                          >
                            <PlusCircle className="w-3 h-3" /> + تشغيلة
                          </button>
                        )}
                      </div>
                    )}

                    {/* Actions Row */}
                    {(canEditProduct || canDeleteProduct) && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {Boolean((p as any).wc_product_id) && (
                          <button
                            onClick={() => handlePushStock(p)}
                            disabled={syncingProductId === p.id}
                            className="min-h-[36px] px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl flex items-center gap-1 active:bg-purple-200 disabled:opacity-50"
                            title="مزامنة الرصيد مع ووكومرس فورياً"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncingProductId === p.id ? 'animate-spin' : ''}`} />
                            ووكومرس
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPrintProduct(p)}
                          className="min-h-[36px] px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center gap-1 active:bg-indigo-200"
                        >
                          <Barcode className="w-3.5 h-3.5" />
                          باركود
                        </button>
                        {canEditProduct && (
                          <button
                            onClick={() => openEditModal(p)}
                            className="min-h-[36px] px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1 active:bg-slate-300"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            تعديل
                          </button>
                        )}
                        {canDeleteProduct && (
                          <button
                            onClick={() => handleDelete(p)}
                            className="min-h-[36px] p-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl active:bg-rose-200"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

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

      {/* Add Batch Modal */}
      <AddBatchModal
        product={selectedBatchProduct}
        isOpen={Boolean(selectedBatchProduct)}
        onClose={() => setSelectedBatchProduct(null)}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 3500);
        }}
      />

      {/* Barcode Label Print Modal */}
      <BarcodePrintModal
        product={selectedPrintProduct}
        isOpen={Boolean(selectedPrintProduct)}
        onClose={() => setSelectedPrintProduct(null)}
      />

      {/* Opening Stock Balance Modal */}
      <OpeningStockModal
        isOpen={isOpeningStockOpen}
        onClose={() => setIsOpeningStockOpen(false)}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 4000);
        }}
        products={products}
      />
    </div>
  );
};
