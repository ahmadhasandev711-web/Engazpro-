import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ExchangeRecord,
  Invoice,
  Party,
  PaymentMethod,
  ReturnItemCondition,
  formatCurrency,
} from '@pos-mandob/shared';
import {
  ArrowRight,
  Lock,
  ShieldAlert,
  Trash2,
  Wallet,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { fetchPartySelectOptions } from '../../data/api/asyncOptionLoaders';
import { usePermissions } from '../../hooks/usePermissions';
import { useExchangeLookup, useExecutePosExchange, usePartyStoreCredit } from '../../hooks/useExchange';
import { useToast } from '../context/ToastContext';
import { AsyncSearchSelect, Badge, Button, Card, Input, PageHeader } from '../components/ui';
import { InvoiceParentLookup } from '../components/invoice/InvoiceParentLookup';
import { ExchangeProductPicker, SelectedExchangeVariantItem } from '../components/exchange/ExchangeProductPicker';
import { ExchangeReceiptModal } from '../components/exchange/ExchangeReceiptModal';

interface ReturnRow extends SelectedExchangeVariantItem {
  max_returnable: number;
  condition: ReturnItemCondition;
}

export const PosExchangePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { isOwnerOrAdmin, isManager } = usePermissions();
  const canOverrideSalesperson = isOwnerOrAdmin || isManager;

  const [lookupInput, setLookupInput] = useState('');
  const [lookupMatches, setLookupMatches] = useState<Invoice[]>([]);
  const [parentInvoice, setParentInvoice] = useState<Invoice | null>(null);
  const [returnedItems, setReturnedItems] = useState<ReturnRow[]>([]);
  const [replacementItems, setReplacementItems] = useState<SelectedExchangeVariantItem[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>(PaymentMethod.CASH);
  const [surplusSettlement, setSurplusSettlement] = useState<'STORE_CREDIT' | 'REFUND_CASH'>('STORE_CREDIT');
  const [replacementSalespersonId, setReplacementSalespersonId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [completedExchange, setCompletedExchange] = useState<ExchangeRecord | null>(null);

  const lookupMutation = useExchangeLookup();
  const executeMutation = useExecutePosExchange();

  const { data: identityData } = useQuery({
    queryKey: ['store-identity'],
    queryFn: async () => (await apiClient.get('/settings/store-identity')).data?.data,
  });

  const { data: staffData = [] } = useQuery<any[]>({
    queryKey: ['employees-for-exchange'],
    queryFn: async () => (await apiClient.get('/employees')).data?.data || [],
    enabled: canOverrideSalesperson,
  });

  const { data: walletInfo } = usePartyStoreCredit(selectedParty?.id);

  // Auto-load invoice if navigated directly from InvoicesPage row button
  const prefillInvoiceId = searchParams.get('invoiceId');
  useEffect(() => {
    if (!prefillInvoiceId) return;
    apiClient
      .get(`/invoices/${prefillInvoiceId}`)
      .then((res) => {
        const inv: Invoice | undefined = res.data?.data;
        if (inv) {
          applySelectedParentInvoice(inv);
        }
      })
      .catch(() => {
        toast.error('تعذر جلب الفاتورة المحددة للاستبدال.');
      });
  }, [prefillInvoiceId]);

  const applySelectedParentInvoice = async (inv: Invoice) => {
    try {
      const res = await apiClient.get(`/invoices/by-number/${encodeURIComponent(inv.invoice_number)}`, {
        params: { for_return: 1, return_type: 'SALE_RETURN' },
      });
      const enriched: Invoice = res.data?.data || inv;
      setParentInvoice(enriched);
      setLookupMatches([]);
      setReturnedItems([]);
      if (enriched.party) {
        setSelectedParty(enriched.party);
      } else if (enriched.party_id) {
        setSelectedParty({ id: enriched.party_id, name: enriched.party_name || 'عميل الفاتورة' } as Party);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'لا تملك صلاحية استرجاع/استبدال هذه الفاتورة');
    }
  };

  const handleLookupSearch = async () => {
    if (!lookupInput.trim()) return;
    try {
      const results = await lookupMutation.mutateAsync(lookupInput);
      if (results.length === 0) {
        toast.error('لم يتم العثور على فواتير بيع مطابقة في هذا الفرع');
        setLookupMatches([]);
        return;
      }
      if (results.length === 1) {
        setParentInvoice(results[0]);
        setLookupMatches([]);
        if (results[0].party) setSelectedParty(results[0].party);
      } else {
        setParentInvoice(null);
        setLookupMatches(results);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر البحث عن الفواتير');
    }
  };

  const handleAddReturnedItemFromParent = (item: any) => {
    const returnable = Number(item.returnable_quantity ?? item.quantity ?? 0);
    if (returnable <= 0) return;
    const unitPrice = Number(item.effective_return_unit_price ?? item.unit_price ?? 0);
    setReturnedItems((prev) => {
      const idx = prev.findIndex(
        (r) => r.product_id === item.product_id && (r.product_variant_id ?? null) === (item.product_variant_id ?? null)
      );
      if (idx >= 0) {
        const next = [...prev];
        if (next[idx].quantity < returnable) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        }
        return next;
      }
      return [
        ...prev,
        {
          product_id: item.product_id,
          product_variant_id: item.product_variant_id ?? null,
          product_name: item.product_name,
          variant_name: item.variant_name ?? null,
          unit_price: unitPrice,
          quantity: 1,
          max_returnable: returnable,
          condition: ReturnItemCondition.SELLABLE,
        },
      ];
    });
  };

  const handleAddUnlinkedReturnItem = (item: SelectedExchangeVariantItem) => {
    setReturnedItems((prev) => [
      ...prev,
      { ...item, max_returnable: 999, condition: ReturnItemCondition.SELLABLE },
    ]);
  };

  const handleAddReplacementItem = (item: SelectedExchangeVariantItem) => {
    setReplacementItems((prev) => {
      const idx = prev.findIndex(
        (r) => r.product_id === item.product_id && (r.product_variant_id ?? null) === (item.product_variant_id ?? null)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, item];
    });
  };

  const returnTotal = useMemo(
    () => returnedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [returnedItems]
  );
  const replacementTotal = useMemo(
    () => replacementItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [replacementItems]
  );
  const rawDiff = replacementTotal - returnTotal;
  const availableCredit = Number(walletInfo?.balance ?? selectedParty?.store_credit_balance ?? 0);
  const creditApplied = useStoreCredit && rawDiff > 0 ? Math.min(availableCredit, rawDiff) : 0;
  const netPayable = rawDiff > 0 ? Math.max(0, rawDiff - creditApplied) : 0;
  const surplusAmount = rawDiff < 0 ? Math.abs(rawDiff) : 0;

  const canUnlinked = canOverrideSalesperson || Boolean(identityData?.allow_cashier_unlinked_exchange);

  const handleExecuteExchange = async () => {
    if (returnedItems.length === 0) {
      toast.error('يجب اختيار قطعة واحدة مرتجعة على الأقل');
      return;
    }
    if (!parentInvoice && !canUnlinked) {
      toast.error('يجب ربط الاستبدال بفاتورة أصلية حسب إعدادات المتجر الحالية');
      return;
    }

    try {
      const record = await executeMutation.mutateAsync({
        original_invoice_id: parentInvoice?.id ?? null,
        branch_id: parentInvoice?.branch_id ?? null,
        party_id: selectedParty?.id ?? null,
        replacement_salesperson_id: canOverrideSalesperson && replacementSalespersonId ? Number(replacementSalespersonId) : null,
        returned_items: returnedItems.map((i) => ({
          product_id: i.product_id,
          product_variant_id: i.product_variant_id ?? null,
          quantity: i.quantity,
          unit_price: i.unit_price,
          condition: i.condition,
        })),
        replacement_items: replacementItems.map((i) => ({
          product_id: i.product_id,
          product_variant_id: i.product_variant_id ?? null,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        store_credit_used: creditApplied,
        surplus_settlement: surplusSettlement,
        payment_method: paymentMethod,
        refund_method: paymentMethod === PaymentMethod.CREDIT ? PaymentMethod.CASH : paymentMethod,
        notes: notes.trim() || undefined,
      });

      toast.success(`تم إتمام الاستبدال بنجاح (${record.exchange_number})`);
      setCompletedExchange(record);
      setReturnedItems([]);
      setReplacementItems([]);
      setParentInvoice(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تنفيذ عملية الاستبدال');
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12" dir="rtl">
      <PageHeader
        title="محرك الاستبدال الذكي (POS)"
        description="تبديل المقاسات والألوان والقطع مع احتساب الفرق ومحفظة رصيد المتجر"
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="md" onClick={() => navigate('/exchanges')}>
              سجل الاستبدالات
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => navigate('/pos')} leftIcon={<ArrowRight className="w-4 h-4" />}>
              الرجوع للكاشير
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Right Pane: Original Invoice & Returned Items */}
        <div className="lg:col-span-6 space-y-4">
          <InvoiceParentLookup
            parentInvoice={parentInvoice}
            invoiceLookupNumber={lookupInput}
            isSearchingInvoice={lookupMutation.isPending}
            allowPhoneAndNameSearch={true}
            lookupMatches={lookupMatches}
            onSelectLookupMatch={applySelectedParentInvoice}
            onSearchNumberChange={setLookupInput}
            onSearchInvoice={handleLookupSearch}
            onClearParentInvoice={() => {
              setParentInvoice(null);
              setReturnedItems([]);
              setLookupMatches([]);
            }}
            onAddItemToReturn={handleAddReturnedItemFromParent}
          />

          <Card className="p-3.5">
            <AsyncSearchSelect<Party>
              label="ملف العميل (اختياري — ضروري لمحفظة رصيد المتجر أو الآجل)"
              placeholder="عميل نقدي (بدون حساب)"
              searchPlaceholder="ابحث باسم العميل أو رقم الموبايل..."
              value={selectedParty?.id ?? null}
              selectedOption={
                selectedParty
                  ? {
                      value: selectedParty.id,
                      label: selectedParty.phone ? `${selectedParty.name} (${selectedParty.phone})` : selectedParty.name,
                      raw: selectedParty,
                    }
                  : null
              }
              queryKeyPrefix="exchange-customer"
              loadOptions={(q) => fetchPartySelectOptions('CUSTOMER', q, true)}
              allowClear={true}
              clearLabel="إلغاء تحديد العميل"
              onChange={(opt) => setSelectedParty(opt?.raw ?? null)}
            />
          </Card>

          {!parentInvoice && canUnlinked && (
            <Card className="p-4 space-y-3 border-dashed border-brand/30">
              <div className="text-xs font-bold text-info flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                إضافة مرتجع حر (بدون فاتورة أصلية - متاح بالصلاحية)
              </div>
              <ExchangeProductPicker
                branchId={null}
                title="اختر القطعة المرتجعة ومقاسها"
                onAdd={handleAddUnlinkedReturnItem}
              />
            </Card>
          )}

          {/* Selected Returned Items */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink">القطع المرتجعة ({returnedItems.length})</h3>
              <span className="text-sm font-black text-warn tabular-nums">{formatCurrency(returnTotal)}</span>
            </div>

            {returnedItems.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">ابحث عن الفاتورة برقمها أو بموبايل العميل ثم اضغط على الصنف لإرجاعه.</p>
            ) : (
              <div className="space-y-2">
                {returnedItems.map((item, idx) => (
                  <div key={`${item.product_id}-${item.product_variant_id ?? 0}-${idx}`} className="p-3 rounded-xl bg-surface-2/70 border border-line space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-ink">{item.product_name}</span>
                        {item.variant_name && <Badge tone="info" className="mr-1.5 text-[10px]">{item.variant_name}</Badge>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setReturnedItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-bad hover:opacity-80 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={item.max_returnable}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Math.min(item.max_returnable, Math.max(1, Number(e.target.value) || 1));
                            setReturnedItems((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r)));
                          }}
                          className="w-16 px-2 py-1 rounded-lg border border-line bg-panel text-center font-bold tabular-nums"
                        />
                        <span className="text-muted tabular-nums">× {formatCurrency(item.unit_price)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setReturnedItems((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, condition: ReturnItemCondition.SELLABLE } : r))
                            )
                          }
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] border ${
                            item.condition === ReturnItemCondition.SELLABLE
                              ? 'bg-ok-soft border-ok text-ok'
                              : 'bg-panel border-line text-muted'
                          }`}
                        >
                          سليم (يرجع للمخزون)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReturnedItems((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, condition: ReturnItemCondition.DAMAGED } : r))
                            )
                          }
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] border ${
                            item.condition === ReturnItemCondition.DAMAGED
                              ? 'bg-bad-soft border-bad text-bad'
                              : 'bg-panel border-line text-muted'
                          }`}
                        >
                          تالف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Anti-Fraud Salesperson Lock */}
          <Card className="p-3.5 bg-surface-2/60 border-line text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-brand" />
                تثبيت عمولة البائع الأصلي
              </span>
              {parentInvoice && (
                <Badge tone="info" className="text-[11px]">
                  {(parentInvoice as any).salesperson_name || (parentInvoice as any).created_by_name || 'مبيعات أونلاين'}
                </Badge>
              )}
            </div>
            {canOverrideSalesperson ? (
              <select
                value={replacementSalespersonId}
                onChange={(e) => setReplacementSalespersonId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-panel border border-line text-xs font-bold"
              >
                <option value="">-- الحفاظ على البائع الأصلي تلقائياً (الأكثر أماناً) --</option>
                {staffData.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    تعيين بديل: {emp.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[11px] text-muted flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-warn shrink-0" />
                يُرث بائع الفاتورة الأصلية تلقائياً لحماية العمولات ولا يمكن تغييره من حساب الكاشير.
              </p>
            )}
          </Card>
        </div>

        {/* Left Pane: Replacement Cart & Settlement */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-4">
            <ExchangeProductPicker
              branchId={parentInvoice?.branch_id ?? null}
              onAdd={handleAddReplacementItem}
            />
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink">سلة القطع البديلة ({replacementItems.length})</h3>
              <span className="text-sm font-black text-ok tabular-nums">{formatCurrency(replacementTotal)}</span>
            </div>

            {replacementItems.length > 0 && (
              <div className="space-y-2">
                {replacementItems.map((item, idx) => (
                  <div key={`${item.product_id}-${item.product_variant_id ?? 0}-${idx}`} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-2/70 border border-line text-xs">
                    <div className="min-w-0">
                      <span className="font-black text-ink">{item.product_name}</span>
                      {item.variant_name && <Badge tone="ok" className="mr-1.5 text-[10px]">{item.variant_name}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setReplacementItems((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r)));
                        }}
                        className="w-14 px-2 py-1 rounded-lg border border-line bg-panel text-center font-bold tabular-nums"
                      />
                      <span className="tabular-nums font-bold text-ink">{formatCurrency(item.unit_price * item.quantity)}</span>
                      <button
                        type="button"
                        onClick={() => setReplacementItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-bad hover:opacity-80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Settlement Breakdown */}
            <div className="pt-3 border-t border-line space-y-2.5 text-xs">
              {selectedParty && availableCredit > 0 && (
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-info-soft border border-info/30 cursor-pointer">
                  <span className="font-bold text-info flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    استخدام رصيد محفظة العميل ({formatCurrency(availableCredit)})
                  </span>
                  <input
                    type="checkbox"
                    checked={useStoreCredit}
                    onChange={(e) => setUseStoreCredit(e.target.checked)}
                    className="w-4 h-4 accent-brand"
                  />
                </label>
              )}

              {rawDiff > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between font-black text-sm text-brand">
                    <span>صافي الفرق المطلوب تحصيله من العميل:</span>
                    <span className="tabular-nums">{formatCurrency(netPayable)}</span>
                  </div>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-panel border border-line text-xs font-bold"
                  >
                    <option value={PaymentMethod.CASH}>نقدي (كاش بالدرج)</option>
                    <option value={PaymentMethod.CARD}>بطاقة / فيزا POS</option>
                    <option value={PaymentMethod.INSTAPAY}>تحويل إنستاباي</option>
                    <option value={PaymentMethod.VODAFONE_CASH}>فودافون كاش / محفظة</option>
                    {selectedParty && <option value={PaymentMethod.CREDIT}>آجل (على حساب العميل)</option>}
                  </select>
                </div>
              )}

              {surplusAmount > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between font-black text-sm text-info">
                    <span>فائض لصالح العميل:</span>
                    <span className="tabular-nums">{formatCurrency(surplusAmount)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSurplusSettlement('STORE_CREDIT')}
                      disabled={!selectedParty}
                      className={`p-2 rounded-xl border font-bold text-center ${
                        surplusSettlement === 'STORE_CREDIT'
                          ? 'bg-brand-soft border-brand text-brand-ink'
                          : 'bg-panel border-line text-muted'
                      } disabled:opacity-50`}
                    >
                      ترحيل لمحفظة العميل
                    </button>
                    <button
                      type="button"
                      onClick={() => setSurplusSettlement('REFUND_CASH')}
                      className={`p-2 rounded-xl border font-bold text-center ${
                        surplusSettlement === 'REFUND_CASH'
                          ? 'bg-warn-soft border-warn text-warn'
                          : 'bg-panel border-line text-muted'
                      }`}
                    >
                      رد الفرق نقداً
                    </button>
                  </div>
                </div>
              )}

              {rawDiff === 0 && returnedItems.length > 0 && (
                <div className="p-2.5 rounded-xl bg-ok-soft text-ok font-black text-center">
                  استبدال متساوي — لا يوجد فرق مالي على الخزنة (0.00 ج.م)
                </div>
              )}

              <Input
                placeholder="ملاحظات الاستبدال (اختياري)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleExecuteExchange}
                isLoading={executeMutation.isPending}
                disabled={executeMutation.isPending || returnedItems.length === 0}
                leftIcon={<CheckCircle2 className="w-5 h-5" />}
                className="w-full font-black"
              >
                اعتماد وإتمام الاستبدال وطباعة الإيصال
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ExchangeReceiptModal exchange={completedExchange} onClose={() => setCompletedExchange(null)} />
    </div>
  );
};
