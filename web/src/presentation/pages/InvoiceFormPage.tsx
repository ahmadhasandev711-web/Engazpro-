import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Search, AlertCircle, RotateCcw } from 'lucide-react';
import { apiClient } from '../../data/api/client';
import {
  InvoiceSchema,
  InvoiceInput,
  InvoiceType,
  PaymentMethod,
  PartyType,
  Product,
  Party,
  Invoice,
  formatCurrency,
} from '@pos-mandob/shared';
import { InvoiceParentLookup } from '../components/invoice/InvoiceParentLookup';
import { InvoiceItemsTable } from '../components/invoice/InvoiceItemsTable';
import { InvoiceSummaryPanel } from '../components/invoice/InvoiceSummaryPanel';
import { ProductVariantModal, VariantSelectionPayload } from '../components/products/ProductVariantModal';
import { usePermissions } from '../../hooks/usePermissions';
import { nativeBackButton } from '../../platform/nativeBackButton';

export const InvoiceFormPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isSaleReturn = location.pathname.includes('/sales/returns');
  const isPurchaseReturn = location.pathname.includes('/purchases/returns');
  const isPurchase = location.pathname.includes('/purchases') && !isPurchaseReturn;
  const isReturn = isSaleReturn || isPurchaseReturn;
  const isSale = !isPurchase && !isReturn;

  let invoiceType = InvoiceType.SALE;
  let partyType = PartyType.CUSTOMER;
  let pageTitle = 'فاتورة مبيعات جديدة (POS)';

  if (isSaleReturn) {
    invoiceType = InvoiceType.SALE_RETURN;
    partyType = PartyType.CUSTOMER;
    pageTitle = 'مرتجع مبيعات جديد';
  } else if (isPurchaseReturn) {
    invoiceType = InvoiceType.PURCHASE_RETURN;
    partyType = PartyType.SUPPLIER;
    pageTitle = 'مرتجع مشتريات جديد';
  } else if (isPurchase) {
    invoiceType = InvoiceType.PURCHASE;
    partyType = PartyType.SUPPLIER;
    pageTitle = 'فاتورة مشتريات جديدة';
  }

  const { isCashier, isMandob } = usePermissions();
  const [searchProduct, setSearchProduct] = useState('');
  const [invoiceLookupNumber, setInvoiceLookupNumber] = useState('');
  const [parentInvoice, setParentInvoice] = useState<Invoice | null>(null);
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);

  // Hardware Back Button integration
  useEffect(() => {
    if (variantModalProduct) {
      return nativeBackButton.register(() => {
        setVariantModalProduct(null);
        return true;
      });
    }
  }, [variantModalProduct]);

  // Form setup
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceInput>({
    resolver: zodResolver(InvoiceSchema),
    defaultValues: {
      type: invoiceType,
      date: new Date().toISOString().split('T')[0],
      items: [],
      discount: 0,
      tax: 0,
      paid_amount: 0,
      payment_method: PaymentMethod.CASH,
      party_id: null,
      courier_party_id: null,
      parent_invoice_id: null,
      branch_id: null,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Watch values to calculate totals
  const items = watch('items');
  const discount = watch('discount') || 0;
  const tax = watch('tax') || 0;
  const paidAmount = watch('paid_amount') || 0;
  const paymentMethod = watch('payment_method');
  const selectedBranchId = watch('branch_id');

  const subtotal = items.reduce(
    (acc: number, item: any) => acc + (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0),
    0
  );
  const total = Math.max(0, subtotal - discount + tax);
  const remaining = Math.max(0, total - paidAmount);

  // Auto-sync paid_amount when cash / card / transfer
  React.useEffect(() => {
    if (paymentMethod === PaymentMethod.CREDIT) {
      setValue('paid_amount', 0);
    } else {
      setValue('paid_amount', total);
    }
  }, [total, paymentMethod, setValue]);

  // Queries
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return (res.data?.data?.data || res.data?.data || res.data) as any[];
    },
  });

  // Auto-select default / main branch
  React.useEffect(() => {
    if (branchesData && branchesData.length > 0 && !selectedBranchId) {
      const mainBranch = branchesData.find((b: any) => b.is_main) || branchesData[0];
      if (mainBranch) {
        setValue('branch_id', mainBranch.id);
      }
    }
  }, [branchesData, selectedBranchId, setValue]);

  // Queries
  const { data: productsData } = useQuery({
    queryKey: ['products', searchProduct],
    queryFn: async () => {
      const res = await apiClient.get('/products', {
        params: { search: searchProduct || undefined },
      });
      return (res.data?.data?.data || res.data?.data) as Product[];
    },
  });

  const { data: partiesData } = useQuery({
    queryKey: ['parties', partyType],
    queryFn: async () => {
      const res = await apiClient.get('/parties', { params: { type: partyType } });
      return (res.data?.data?.data || res.data?.data) as Party[];
    },
  });

  const { data: couriersData } = useQuery({
    queryKey: ['parties', 'COURIER'],
    queryFn: async () => {
      const res = await apiClient.get('/parties', { params: { type: 'COURIER' } });
      return (res.data?.data?.data || res.data?.data || []) as Party[];
    },
    enabled: isSale,
  });

  const handleSearchInvoice = async () => {
    if (!invoiceLookupNumber.trim()) return;
    setIsSearchingInvoice(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get(`/invoices/by-number/${encodeURIComponent(invoiceLookupNumber.trim())}`);
      const inv: Invoice = res.data.data;
      setParentInvoice(inv);
      setValue('parent_invoice_id', inv.id);
      if (inv.party_id) {
        setValue('party_id', inv.party_id);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'لم يتم العثور على فاتورة بهذا الرقم');
      setParentInvoice(null);
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  const addProductToInvoice = (product: Product, defaultPrice?: number) => {
    const existingIndex = fields.findIndex((f: any) => f.product_id === product.id);
    if (existingIndex >= 0) {
      const currentQty = Number(items[existingIndex]?.quantity || 0);
      setValue(`items.${existingIndex}.quantity`, currentQty + 1, { shouldValidate: true, shouldDirty: true });
    } else {
      const price =
        defaultPrice !== undefined
          ? defaultPrice
          : isPurchase || isPurchaseReturn
          ? product.purchase_price ?? 0
          : product.sale_price;

      append({
        product_id: product.id,
        quantity: 1,
        unit_price: price,
      });
    }
  };

  const handleProductClick = (product: Product, defaultPrice?: number) => {
    const hasVariants = Boolean(product.variants && product.variants.length > 0);
    const hasBatches = Boolean(product.batches && product.batches.length > 0);

    if (hasVariants || hasBatches) {
      setVariantModalProduct(product);
    } else {
      addProductToInvoice(product, defaultPrice);
    }
  };

  const handleVariantSelect = (payload: VariantSelectionPayload) => {
    const prod = payload.product;
    const variantId = payload.variant?.id ?? null;
    const variantName = payload.variant?.name ?? null;
    const batchId = payload.batch?.id ?? null;
    const batchNumber = payload.batch?.batch_number ?? null;

    const existingIndex = fields.findIndex(
      (f: any) =>
        f.product_id === prod.id &&
        (f.product_variant_id ?? null) === variantId &&
        (f.product_batch_id ?? null) === batchId
    );

    if (existingIndex >= 0) {
      const currentQty = Number(items[existingIndex]?.quantity || 0);
      setValue(`items.${existingIndex}.quantity`, currentQty + payload.quantity, { shouldValidate: true, shouldDirty: true });
    } else {
      append({
        product_id: prod.id,
        product_variant_id: variantId,
        variant_name: variantName,
        product_batch_id: batchId,
        batch_number: batchNumber,
        unit_name: payload.unit_name,
        is_sub_unit: payload.is_sub_unit,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
      });
    }
    setVariantModalProduct(null);
  };

  const addParentItemToReturn = (item: any) => {
    const existingIndex = fields.findIndex((f: any) => f.product_id === item.product_id);
    if (existingIndex >= 0) {
      const currentQty = Number(items[existingIndex]?.quantity || 0);
      setValue(`items.${existingIndex}.quantity`, currentQty + 1, { shouldValidate: true, shouldDirty: true });
    } else {
      append({
        product_id: item.product_id,
        quantity: 1,
        unit_price: item.unit_price,
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: InvoiceInput) => {
      return apiClient.post('/invoices', {
        ...data,
        party_id: data.party_id || null,
        parent_invoice_id: data.parent_invoice_id || null,
      });
    },
    onSuccess: () => {
      if (isSaleReturn) navigate('/sales/returns');
      else if (isPurchaseReturn) navigate('/purchases/returns');
      else if (isPurchase) navigate('/purchases');
      else navigate('/sales');
    },
    onError: (err: any) => {
      const errors = err.response?.data?.errors;
      if (errors) {
        const firstErr = Object.values(errors).flat()[0] as string;
        setErrorMessage(firstErr || 'حدث خطأ في التحقق من البيانات المدخلة');
      } else {
        setErrorMessage(err.response?.data?.message || 'حدث خطأ أثناء حفظ الفاتورة');
      }
    },
  });

  const onSubmit = (data: InvoiceInput) => {
    if (data.items.length === 0) {
      setErrorMessage('يجب إضافة صنف واحد على الأقل للمستند');
      return;
    }
    setErrorMessage(null);
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6 h-full flex flex-col pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{pageTitle}</h2>
              {isReturn && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> مرتجع
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isReturn
                ? 'إرجاع بضاعة وضبط حركة المخزون والمديونية فورياً'
                : 'إنشاء فاتورة سريعة مع تحديث المخزون والحسابات'}
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Items & Search */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Invoice Lookup for Returns */}
          {isReturn && (
            <InvoiceParentLookup
              parentInvoice={parentInvoice}
              invoiceLookupNumber={invoiceLookupNumber}
              isSearchingInvoice={isSearchingInvoice}
              onSearchNumberChange={setInvoiceLookupNumber}
              onSearchInvoice={handleSearchInvoice}
              onClearParentInvoice={() => {
                setParentInvoice(null);
                setValue('parent_invoice_id', null);
                setInvoiceLookupNumber('');
              }}
              onAddItemToReturn={addParentItemToReturn}
            />
          )}

          {/* Product Free Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  isReturn
                    ? 'إضافة أصناف حرة للمرتجع (بحث بالاسم أو الباركود)...'
                    : 'ابحث عن صنف بالاسم أو الباركود لإضافته...'
                }
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {searchProduct && productsData && productsData.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productsData.slice(0, 6).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductClick(product)}
                    className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-colors gap-1 text-center"
                  >
                    <span className="font-bold text-sm text-slate-800 truncate w-full">{product.name}</span>
                    {product.variants && product.variants.length > 0 && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">
                        {product.variants.length} مقاسات / ألوان
                      </span>
                    )}
                    <span className="text-xs text-primary-600 font-black">
                      {formatCurrency(
                        Number(isPurchase || isPurchaseReturn ? product.purchase_price ?? 0 : product.sale_price)
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400">المخزون الحالي: {product.quantity}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items Table */}
          <InvoiceItemsTable
            fields={fields}
            items={items}
            productsData={productsData}
            register={register}
            setValue={setValue}
            remove={remove}
            isReturn={isReturn}
          />
        </div>

        {/* Right Side: Details & Settlement */}
        <InvoiceSummaryPanel
          isReturn={isReturn}
          isPurchase={isPurchase}
          isPurchaseReturn={isPurchaseReturn}
          partiesData={partiesData}
          couriersData={couriersData}
          branchesData={branchesData}
          canChangeBranch={!isCashier && !isMandob}
          register={register}
          errors={errors}
          subtotal={subtotal}
          total={total}
          remaining={remaining}
          isPending={saveMutation.isPending}
        />
      </form>

      {/* Mobile Sticky Action Bar */}
      {fields.length > 0 && (
        <div className="lg:hidden fixed bottom-[calc(4.2rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/50 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-300 font-medium">
              {fields.length} أصناف • الإجمالي
            </span>
            <span className="text-base font-black text-emerald-400 font-mono">
              {formatCurrency(total)}
            </span>
          </div>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={handleSubmit(onSubmit)}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
          >
            {saveMutation.isPending ? 'جاري الحفظ...' : isReturn ? 'تأكيد المرتجع' : 'حفظ الفاتورة'}
          </button>
        </div>
      )}

      {/* Product Variant & Batch Selection Modal */}
      <ProductVariantModal
        product={variantModalProduct}
        isOpen={Boolean(variantModalProduct)}
        onClose={() => setVariantModalProduct(null)}
        onSelect={handleVariantSelect}
        mode={isPurchase || isPurchaseReturn ? 'purchase' : 'sale'}
      />
    </div>
  );
};