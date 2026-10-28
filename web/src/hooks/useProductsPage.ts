import { apiClient } from '../data/api/client';
import { nativeBackButton } from '../platform/nativeBackButton';
import { FilterChipOption } from '../presentation/components/mobile/MobileFilterChips';
import { usePermissions } from './usePermissions';
import { zodResolver } from '@hookform/resolvers/zod';
import { Product, ProductSchema, ProductInput } from '@pos-mandob/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Layers, Calendar, Clock } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

export const useProductsPage = () => {
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
  const [page, setPage] = useState<number>(1);
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
    queryKey: ['products', search, filterTab, page],
    queryFn: async () => {
      const params: any = {
        search: search || undefined,
        page,
      };
      if (filterTab === 'VARIABLE') params.type = 'VARIABLE';
      if (filterTab === 'EXPIRY') params.type = 'EXPIRY';
      if (filterTab === 'NEAR_EXPIRY') params.near_expiry = 1;
      if (filterTab === 'LOW_STOCK') params.low_stock = 1;

      const res = await apiClient.get('/products', { params });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const products: Product[] = data?.data || [];
  const meta = data?.meta;

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

  // Hardware Back Button integration for active modals
  useEffect(() => {
    if (isModalOpen) {
      return nativeBackButton.register(() => {
        setIsModalOpen(false);
        return true;
      });
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (selectedBatchProduct) {
      return nativeBackButton.register(() => {
        setSelectedBatchProduct(null);
        return true;
      });
    }
  }, [selectedBatchProduct]);

  useEffect(() => {
    if (selectedPrintProduct) {
      return nativeBackButton.register(() => {
        setSelectedPrintProduct(null);
        return true;
      });
    }
  }, [selectedPrintProduct]);

  useEffect(() => {
    if (isOpeningStockOpen) {
      return nativeBackButton.register(() => {
        setIsOpeningStockOpen(false);
        return true;
      });
    }
  }, [isOpeningStockOpen]);

  const totalProducts = products.length;
  const totalStock = products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
  const lowStockCount = products.filter((p) => p.is_low_stock).length;

  const filterOptions: FilterChipOption<typeof filterTab>[] = useMemo(
    () => [
      { id: 'ALL', label: 'الكل', count: totalProducts },
      { id: 'VARIABLE', label: 'متغيرات', icon: Layers },
      { id: 'EXPIRY', label: 'صلاحيات', icon: Calendar },
      { id: 'NEAR_EXPIRY', label: 'قرب الانتهاء', icon: Clock },
      { id: 'LOW_STOCK', label: 'نواقص', count: lowStockCount, icon: AlertTriangle, variant: 'warning' },
    ],
    [totalProducts, lowStockCount]
  );


  return {
    search,
    setSearch,
    filterTab,
    setFilterTab,
    page,
    setPage,
    isModalOpen,
    setIsModalOpen,
    editingProduct,
    setEditingProduct,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    selectedBatchProduct,
    setSelectedBatchProduct,
    selectedPrintProduct,
    setSelectedPrintProduct,
    isOpeningStockOpen,
    setIsOpeningStockOpen,
    syncingProductId,
    setSyncingProductId,
    productType,
    setProductType,
    hasSubUnit,
    setHasSubUnit,
    variants,
    setVariants,
    batchData,
    setBatchData,
    isMandob,
    canAddProduct,
    canEditProduct,
    canDeleteProduct,
    canImportProducts,
    canViewPurchasePrice,
    data,
    isLoading,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    errors,
    navigate,
    queryClient,
    handlePushStock,
    products,
    meta,
    openCreateModal,
    openEditModal,
    saveMutation,
    deleteMutation,
    onSubmit,
    handleDelete,
    totalProducts,
    totalStock,
    lowStockCount,
    filterOptions,
  };
};
