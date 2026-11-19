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
import { useBranchScope } from '../../hooks/useBranchScope';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui';

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
  const debouncedSearchProduct = useDebouncedValue(searchProduct.trim(), 250);
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

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'items',
  });

  const hasPrefilledRef = React.useRef(false);
  React.useEffect(() => {
    if (hasPrefilledRef.current || !isPurchase) return;
    const navState = location.state as {
      prefillItems?: Array<{
        product_id: number;
        product_name?: string;
        product_variant_id?: number | null;
        variant_name?: string | null;
        unit_name?: string | null;
        quantity: number;
        unit_price: number;
      }>;
      branch_id?: number;
      party_id?: number;
    } | null;

    if (!navState) return;
    if (navState.prefillItems && navState.prefillItems.length > 0) {
      replace(
        navState.prefillItems.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_variant_id: item.product_variant_id ?? null,
          variant_name: item.variant_name ?? null,
          unit_name: item.unit_name ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })) as any
      );
    }
    if (navState.branch_id) {
      setValue('branch_id', navState.branch_id);
    }
    if (navState.party_id) {
      setValue('party_id', navState.party_id);
    }
    hasPrefilledRef.current = true;
  }, [isPurchase, location.state, replace, setValue]);

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
  const { hasGlobalBranchAccess, lockedBranchId, resolveEffectiveBranchId } = useBranchScope();
  const effectiveFormBranchId = resolveEffectiveBranchId(selectedBranchId);
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return (res.data?.data?.data || res.data?.data || res.data) as any[];
    },
  });

  // Auto-select locked branch or default / main branch
  React.useEffect(() => {
    if (!hasGlobalBranchAccess && lockedBranchId) {
      if (selectedBranchId !== lockedBranchId) {
        setValue('branch_id', lockedBranchId);
      }
      return;
    }
    if (branchesData && branchesData.length > 0 && !selectedBranchId) {
      const mainBranch = branchesData.find((b: any) => b.is_main) || branchesData[0];
      if (mainBranch) {
        setValue('branch_id', mainBranch.id);
      }
    }
  }, [branchesData, selectedBranchId, setValue, hasGlobalBranchAccess, lockedBranchId]);

  // Queries
  const { data: productsData } = useQuery({
    queryKey: ['products-form', debouncedSearchProduct, effectiveFormBranchId],
    queryFn: async () => {
      const res = await apiClient.get('/products/pos-catalog', {
        params: {
          search: debouncedSearchProduct || undefined,
          branch_id: effectiveFormBranchId || undefined,
          per_page: 24,
        },
      });
      return (res.data?.data?.data || res.data?.data) as Product[];
    },
    placeholderData: (prev) => prev,
  });

  const { data: couriersData } = useQuery({
    queryKey: ['parties', 'COURIER'],
    queryFn: async () => {
      const res = await apiClient.get('/parties', { params: { type: 'COURIER', per_page: 100 } });
      return (res.data?.data?.data || res.data?.data || []) as Party[];
    },
    enabled: isSale,
  });

  const performParentInvoiceLookup = React.useCallback(
    async (targetNumber: string) => {
      const cleaned = targetNumber.trim();
      if (!cleaned) return;
      setIsSearchingInvoice(true);
      setErrorMessage(null);
      try {
        const res = await apiClient.get(`/invoices/by-number/${encodeURIComponent(cleaned)}`, {
          params: { for_return: 1, return_type: invoiceType },
        });
        const inv: Invoice = res.data.data;
        setParentInvoice(inv);
        setValue('parent_invoice_id', inv.id);
        if (inv.party_id) {
          setValue('party_id', inv.party_id);
        }
        if (inv.branch_id && !isCashier && !isMandob) {
          setValue('branch_id', inv.branch_id);
        }
      } catch (err: any) {
        setErrorMessage(err.response?.data?.message || 'لم يتم العثور على فاتورة بهذا الرقم');
        setParentInvoice(null);
      } finally {
        setIsSearchingInvoice(false);
      }
    },
    [invoiceType, isCashier, isMandob, setValue]
  );

  const handleSearchInvoice = () => {
    void performParentInvoiceLookup(invoiceLookupNumber);
  };

  const autoLookedUpParentRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!isReturn) return;
    const parentParam = new URLSearchParams(location.search).get('parent')?.trim();
    if (parentParam && autoLookedUpParentRef.current !== parentParam) {
      autoLookedUpParentRef.current = parentParam;
      setInvoiceLookupNumber(parentParam);
      void performParentInvoiceLookup(parentParam);
    }
  }, [isReturn, location.search, performParentInvoiceLookup]);

  const isSameInvoiceLine = (line: any, candidate: any) =>
    Number(line.product_id) === Number(candidate.product_id) &&
    (line.product_variant_id ?? null) === (candidate.product_variant_id ?? null) &&
    (line.product_batch_id ?? null) === (candidate.product_batch_id ?? null) &&
    (line.unit_name ?? null) === (candidate.unit_name ?? null);

  const addProductToInvoice = (product: Product, defaultPrice?: number) => {
    const candidate = {
      product_id: product.id,
      product_variant_id: null,
      product_batch_id: null,
      unit_name: product.unit ?? null,
    };
    const existingIndex = fields.findIndex((f: any) => isSameInvoiceLine(f, candidate));
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
        product_name: product.name,
        unit_name: product.unit ?? null,
        quantity: 1,
        unit_price: price,
      } as any);
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
    const candidate = {
      product_id: prod.id,
      product_variant_id: payload.variant?.id ?? null,
      variant_name: payload.variant?.name ?? null,
      product_batch_id: payload.batch?.id ?? null,
      batch_number: payload.batch?.batch_number ?? null,
      unit_name: payload.unit_name ?? null,
    };

    const existingIndex = fields.findIndex((f: any) => isSameInvoiceLine(f, candidate));

    if (existingIndex >= 0) {
      const currentQty = Number(items[existingIndex]?.quantity || 0);
      setValue(`items.${existingIndex}.quantity`, currentQty + payload.quantity, { shouldValidate: true, shouldDirty: true });
    } else {
      append({
        ...candidate,
        product_name: prod.name,
        is_sub_unit: payload.is_sub_unit,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
      } as any);
    }
    setVariantModalProduct(null);
  };

  const addParentItemToReturn = (item: any) => {
    const candidate = {
      product_id: item.product_id,
      product_variant_id: item.product_variant_id ?? null,
      variant_name: item.variant_name ?? null,
      product_batch_id: item.product_batch_id ?? null,
      batch_number: item.batch_number ?? null,
      expiry_date: item.expiry_date ?? null,
      unit_name: item.unit_name ?? null,
    };
    const existingIndex = fields.findIndex((f: any) => isSameInvoiceLine(f, candidate));
    const maxQty = Number(item.returnable_quantity ?? item.quantity ?? 0);

    if (maxQty <= 0) {
      setErrorMessage(`تم استرجاع كامل كمية "${item.product_name}" مسبقاً من هذه الفاتورة.`);
      return;
    }

    if (existingIndex >= 0) {
      const currentQty = Number(items[existingIndex]?.quantity || 0);
      if (currentQty >= maxQty) {
        setErrorMessage(`الكمية المسترجعة من "${item.product_name}" لا يمكن أن تتجاوز الكمية المتبقية (${maxQty}).`);
        return;
      }
      setValue(`items.${existingIndex}.quantity`, currentQty + 1, { shouldValidate: true, shouldDirty: true });
    } else {
      setErrorMessage(null);
      append({
        ...candidate,
        product_name: item.product_name,
        quantity: 1,
        unit_price: Number(item.effective_return_unit_price ?? item.unit_price ?? 0),
      } as any);
    }
  };

  const shouldRedirectToPosExchangeRef = React.useRef(false);

  const saveMutation = useMutation({
    mutationFn: async (data: InvoiceInput) => {
      return apiClient.post('/invoices', {
        ...data,
        party_id: data.party_id || null,
        parent_invoice_id: data.parent_invoice_id || null,
      });
    },
    onSuccess: (res: any) => {
      if (isSaleReturn && shouldRedirectToPosExchangeRef.current) {
        shouldRedirectToPosExchangeRef.current = false;
        const savedInv = res.data?.data || res.data;
        navigate('/pos', {
          state: {
            exchangeFromReturn: {
              id: savedInv?.id,
              invoice_number: savedInv?.invoice_number,
              total: Number(savedInv?.total ?? total) || 0,
              party_id: savedInv?.party_id ?? watch('party_id') ?? null,
              party_name: savedInv?.party_name || parentInvoice?.party_name || null,
            },
          },
        });
        return;
      }
      shouldRedirectToPosExchangeRef.current = false;
      if (isSaleReturn) navigate('/sales/returns');
      else if (isPurchaseReturn) navigate('/purchases/returns');
      else if (isPurchase) navigate('/purchases');
      else navigate('/sales');
    },
    onError: (err: any) => {
      shouldRedirectToPosExchangeRef.current = false;
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
      <div className="flex items-start sm:items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => navigate(-1)}
          className="px-3 shrink-0"
          title="رجوع"
          aria-label="رجوع"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <PageHeader
          title={pageTitle}
          description={
            isReturn
              ? 'إرجاع بضاعة وضبط حركة المخزون والمديونية فورياً'
              : 'إنشاء فاتورة سريعة مع تحديث المخزون والحسابات'
          }
          badge={
            isReturn ? (
              <Badge tone="warn">
                <RotateCcw className="w-3 h-3" />
                مرتجع
              </Badge>
            ) : undefined
          }
          className="mb-0 flex-1"
        />
      </div>

      {errorMessage && (
        <div className="p-4 bg-bad-soft border border-bad/30 text-bad text-sm rounded-xl flex items-center gap-2">
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
              isPurchaseReturn={isPurchaseReturn}
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
          <Card className="p-4 space-y-4">
            <Input
              type="text"
              placeholder={
                isReturn
                  ? 'إضافة أصناف حرة للمرتجع (بحث بالاسم أو الباركود)...'
                  : 'ابحث عن صنف بالاسم أو الباركود لإضافته...'
              }
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
              className="bg-surface-2/60"
            />

            {searchProduct && productsData && productsData.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productsData.slice(0, 6).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductClick(product)}
                    className="min-h-[44px] flex flex-col items-center justify-center p-3 bg-panel border border-line rounded-xl hover:border-brand hover:bg-brand-soft/40 transition-colors gap-1 text-center cursor-pointer"
                  >
                    <span className="font-bold text-sm text-ink truncate w-full">{product.name}</span>
                    {product.variants && product.variants.length > 0 && (
                      <Badge tone="info" className="text-[11px]">
                        {product.variants.length} مقاسات / ألوان
                      </Badge>
                    )}
                    <span className="text-xs text-brand font-black tabular-nums">
                      {formatCurrency(
                        Number(isPurchase || isPurchaseReturn ? product.purchase_price ?? 0 : product.sale_price)
                      )}
                    </span>
                    <span className="text-[11px] text-muted tabular-nums">
                      المخزون الحالي: {product.quantity}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

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
          partyType={partyType}
          selectedPartyId={watch('party_id')}
          selectedPartyName={parentInvoice?.party_name || parentInvoice?.party?.name || null}
          onPartyChange={(partyId) => setValue('party_id', partyId, { shouldValidate: true })}
          couriersData={couriersData}
          branchesData={branchesData}
          canChangeBranch={hasGlobalBranchAccess}
          register={register}
          errors={errors}
          subtotal={subtotal}
          total={total}
          remaining={remaining}
          isPending={saveMutation.isPending}
          onSaveAndExchangeInPos={
            isSaleReturn
              ? () => {
                  shouldRedirectToPosExchangeRef.current = true;
                  handleSubmit(onSubmit)();
                }
              : undefined
          }
        />
      </form>

      {/* Mobile Sticky Action Bar */}
      {fields.length > 0 && (
        <div className="lg:hidden fixed bottom-[calc(4.2rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 bg-panel/95 backdrop-blur-md text-ink px-4 py-3 rounded-2xl shadow-2xl border border-line flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted font-medium tabular-nums">
              {fields.length} أصناف • الإجمالي
            </span>
            <span className="text-base font-black text-ok tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={saveMutation.isPending}
            isLoading={saveMutation.isPending}
            onClick={handleSubmit(onSubmit)}
            className="text-xs font-black"
          >
            {saveMutation.isPending ? 'جاري الحفظ...' : isReturn ? 'تأكيد المرتجع' : 'حفظ الفاتورة'}
          </Button>
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
