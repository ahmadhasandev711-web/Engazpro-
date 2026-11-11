import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  CreditCard,
  CalendarClock,
  Printer,
  CheckCircle2,
  AlertCircle,
  Coins,
  Zap,
  Smartphone,
  Layers,
  UserCheck,
} from 'lucide-react';
import { formatCurrency, PaymentMethod } from '@pos-mandob/shared';
import { apiClient } from '../../../data/api/client';
import { CustomerParty } from './PosCartTicket';
import { PosCartItem } from '../../../hooks/useHoldInvoices';
import { Button } from '../ui/Button';

interface PosPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  customer: CustomerParty | null;
  items: PosCartItem[];
  discount: number;
  shippingCost?: number;
  courierPartyId?: number | null;
  branchId?: number | null;
  onPaymentSuccess: (createdInvoice: any, shouldPrint: boolean) => void;
}

export const PosPaymentModal: React.FC<PosPaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  customer,
  items,
  discount,
  shippingCost = 0,
  courierPartyId,
  branchId,
  onPaymentSuccess,
}) => {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [receivedAmount, setReceivedAmount] = useState<number | string>(totalAmount);
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [salespersonId, setSalespersonId] = useState<string | number>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active employees for salesperson commission attribution
  const { data: rawEmployees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await apiClient.get('/employees');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });
  const employeesList: any[] = Array.isArray(rawEmployees) ? rawEmployees : ((rawEmployees as any)?.data || []);

  const salesStaff = useMemo(() => {
    return employeesList.filter(
      (e: any) =>
        e.status === 'ACTIVE' &&
        (e.role === 'SALES' || e.role === 'CASHIER' || e.role === 'MANDOB' || e.role === 'SUPERVISOR') &&
        (!branchId || !e.branch_id || e.branch_id === branchId)
    );
  }, [employeesList, branchId]);

  // Split Payment Inputs
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitCard, setSplitCard] = useState<string>('');
  const [splitInstapay, setSplitInstapay] = useState<string>('');
  const [splitVodafone, setSplitVodafone] = useState<string>('');

  // Sync received amount whenever modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setReceivedAmount(totalAmount);
      setError(null);
      setReferenceNumber('');
      setSplitCash('');
      setSplitCard('');
      setSplitInstapay('');
      setSplitVodafone('');
      setSalespersonId('');
    }
  }, [isOpen, totalAmount]);

  const numReceived = Number(receivedAmount) || 0;
  const change = useMemo(() => {
    return Math.round((numReceived - totalAmount) * 100) / 100;
  }, [numReceived, totalAmount]);

  // Split calculations
  const splitTotalPaid = useMemo(() => {
    return (
      (Number(splitCash) || 0) +
      (Number(splitCard) || 0) +
      (Number(splitInstapay) || 0) +
      (Number(splitVodafone) || 0)
    );
  }, [splitCash, splitCard, splitInstapay, splitVodafone]);

  const splitRemaining = useMemo(() => {
    return Math.round((totalAmount - splitTotalPaid) * 100) / 100;
  }, [totalAmount, splitTotalPaid]);

  if (!isOpen) return null;

  const handleSubmit = async (shouldPrint: boolean) => {
    setError(null);

    // Validation
    if (method === PaymentMethod.CREDIT && !customer?.id) {
      setError('لا يمكن إصدار فاتورة آجلة لعميل نقدي بدون حساب. يرجى اختيار عميل أولاً.');
      return;
    }

    if (method === PaymentMethod.CASH && numReceived < totalAmount) {
      setError('المبلغ المستلم نقداً أقل من إجمالي الفاتورة! يرجى إدخال المبلغ كاملاً أو اختيار عميل لتسجيل المتبقي كآجل.');
      return;
    }

    if (method === PaymentMethod.SPLIT) {
      if (splitTotalPaid <= 0) {
        setError('يرجى تحديد المبلغ المدفوع في طريقة واحدة على الأقل في الدفع المجزأ.');
        return;
      }
      if (splitTotalPaid > totalAmount) {
        setError('إجمالي مبالغ الدفع المجزأ أكبر من إجمالي الفاتورة المطلوبة!');
        return;
      }
      if (splitRemaining > 0 && !customer?.id) {
        setError('إجمالي الدفع المجزأ أقل من المطلوب. لترحيل المتبقي كآجل، يجب اختيار عميل أولاً.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let paidAmount = totalAmount;
      let splitPaymentsPayload: any[] | undefined = undefined;

      if (method === PaymentMethod.CREDIT) {
        paidAmount = 0;
      } else if (method === PaymentMethod.SPLIT) {
        paidAmount = splitTotalPaid;
        splitPaymentsPayload = [];
        if (Number(splitCash) > 0) {
          splitPaymentsPayload.push({ method: PaymentMethod.CASH, amount: Number(splitCash), notes: 'نقدي باليد' });
        }
        if (Number(splitCard) > 0) {
          splitPaymentsPayload.push({ method: PaymentMethod.CARD, amount: Number(splitCard), notes: 'بطاقة فيزا' });
        }
        if (Number(splitInstapay) > 0) {
          splitPaymentsPayload.push({ method: PaymentMethod.INSTAPAY, amount: Number(splitInstapay), notes: 'تحويل إنستاباي' });
        }
        if (Number(splitVodafone) > 0) {
          splitPaymentsPayload.push({ method: PaymentMethod.VODAFONE_CASH, amount: Number(splitVodafone), notes: 'محفظة فودافون كاش' });
        }
      }

      const fullNotes = [notes, referenceNumber ? `مرجع الدفع: ${referenceNumber}` : null]
        .filter(Boolean)
        .join(' | ');

      const payload = {
        type: 'SALE',
        branch_id: branchId || undefined,
        salesperson_id: salespersonId ? Number(salespersonId) : undefined,
        date: new Date().toISOString().split('T')[0],
        party_id: customer?.id || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_variant_id: i.product_variant_id || undefined,
          product_batch_id: i.product_batch_id || undefined,
          variant_name: i.variant_name || undefined,
          batch_number: i.batch_number || undefined,
          expiry_date: i.expiry_date || undefined,
          unit_name: i.unit_name || undefined,
          is_sub_unit: Boolean(i.is_sub_unit),
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        discount: discount || 0,
        shipping_amount: shippingCost || 0,
        courier_party_id: courierPartyId || undefined,
        payment_method: method,
        paid_amount: paidAmount,
        split_payments: splitPaymentsPayload,
        notes: fullNotes || undefined,
      };

      const res = await apiClient.post('/invoices', payload);
      const createdInvoice = res.data?.data;
      onPaymentSuccess(createdInvoice, shouldPrint);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر تسجيل وحفظ الفاتورة، يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCash = (amount: number) => {
    const current = Number(receivedAmount) || 0;
    setReceivedAmount(current + amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-panel rounded-3xl w-full max-w-lg shadow-2xl border border-line flex flex-col max-h-[92vh] overflow-hidden text-ink">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-surface-1/50">
          <div>
            <h3 className="text-base font-black text-ink">إتمام عملية البيع والتحصيل</h3>
            <p className="text-xs text-muted">
              العميل: <strong className="text-ink">{customer?.name || 'نقدي (عميل كاش)'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted hover:text-ink hover:bg-surface-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Total Amount Banner */}
          <div className="bg-surface-2 border-2 border-line p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-muted block mb-0.5">إجمالي الفاتورة المطلوب:</span>
              <span className="text-3xl font-black text-ink tracking-tight">{formatCurrency(totalAmount)}</span>
            </div>
            {customer && (
              <div className="text-right">
                <span className="text-[11px] font-medium text-muted block mb-0.5">حساب العميل:</span>
                <span className="text-xs font-bold text-ok bg-ok-soft border border-ok/20 px-2.5 py-1 rounded-lg inline-block">مسجل بالنظام ✓</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-bad-soft border border-bad/20 rounded-xl text-xs font-bold text-bad flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-bad shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Method Selector (>= 48px height) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-ink">طريقة الدفع والتحصيل:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Cash */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.CASH);
                  setReceivedAmount(totalAmount);
                }}
                className={`min-h-[48px] p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  method === PaymentMethod.CASH
                    ? 'border-brand bg-brand-soft text-brand-ink shadow-xs ring-2 ring-brand/20'
                    : 'bg-panel border-line text-ink hover:bg-surface-2'
                }`}
              >
                <Coins className="w-5 h-5" />
                <span>نقدي (كاش)</span>
              </button>

              {/* Card / Visa */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.CARD);
                  setReceivedAmount(totalAmount);
                }}
                className={`min-h-[48px] p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  method === PaymentMethod.CARD
                    ? 'border-brand bg-brand-soft text-brand-ink shadow-xs ring-2 ring-brand/20'
                    : 'bg-panel border-line text-ink hover:bg-surface-2'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>بطاقة / فيزا</span>
              </button>

              {/* InstaPay */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.INSTAPAY);
                  setReceivedAmount(totalAmount);
                }}
                className={`min-h-[48px] p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  method === PaymentMethod.INSTAPAY
                    ? 'border-brand bg-brand-soft text-brand-ink shadow-xs ring-2 ring-brand/20'
                    : 'bg-panel border-line text-ink hover:bg-surface-2'
                }`}
              >
                <Zap className="w-5 h-5" />
                <span>إنستاباي (InstaPay)</span>
              </button>

              {/* Vodafone Cash */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.VODAFONE_CASH);
                  setReceivedAmount(totalAmount);
                }}
                className={`min-h-[48px] p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  method === PaymentMethod.VODAFONE_CASH
                    ? 'border-brand bg-brand-soft text-brand-ink shadow-xs ring-2 ring-brand/20'
                    : 'bg-panel border-line text-ink hover:bg-surface-2'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span>فودافون كاش ومحافظ</span>
              </button>

              {/* Credit / On Account */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.CREDIT);
                  setReceivedAmount(0);
                }}
                className={`min-h-[48px] p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  method === PaymentMethod.CREDIT
                    ? 'border-brand bg-brand-soft text-brand-ink shadow-xs ring-2 ring-brand/20'
                    : 'bg-panel border-line text-ink hover:bg-surface-2'
                }`}
              >
                <CalendarClock className="w-5 h-5" />
                <span>آجل (على الحساب)</span>
              </button>

              {/* Split Payment */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.SPLIT);
                  setReceivedAmount(totalAmount);
                }}
                className={`min-h-[48px] p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  method === PaymentMethod.SPLIT
                    ? 'border-brand bg-brand-soft text-brand-ink shadow-xs ring-2 ring-brand/20'
                    : 'bg-panel border-line text-ink hover:bg-surface-2'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span>دفع مجزأ (متعدد)</span>
              </button>
            </div>
          </div>

          {/* Cash Details & Change Calculator */}
          {method === PaymentMethod.CASH && (
            <div className="bg-surface-1/60 p-4 rounded-2xl border border-line space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-ink flex items-center justify-between">
                  <span>المبلغ المستلم من العميل نقداً باليد:</span>
                  <span className="text-muted font-normal">المطلوب: {formatCurrency(totalAmount)}</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className="w-full text-2xl font-black pl-14 pr-4 py-3 bg-panel border-2 border-line focus:border-brand rounded-2xl text-ink focus:outline-none focus:ring-4 focus:ring-brand-soft transition-all shadow-xs"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                    ج.م
                  </span>
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setReceivedAmount(totalAmount)}
                  className="px-3 py-2 min-h-[36px] bg-panel border border-line hover:bg-surface-2 text-ink rounded-xl text-xs font-bold transition-colors"
                >
                  بالضبط
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(10)}
                  className="px-3 py-2 min-h-[36px] bg-panel border border-line hover:bg-surface-2 text-ink rounded-xl text-xs font-bold transition-colors"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(20)}
                  className="px-3 py-2 min-h-[36px] bg-panel border border-line hover:bg-surface-2 text-ink rounded-xl text-xs font-bold transition-colors"
                >
                  +20
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(50)}
                  className="px-3 py-2 min-h-[36px] bg-panel border border-line hover:bg-surface-2 text-ink rounded-xl text-xs font-bold transition-colors"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(100)}
                  className="px-3 py-2 min-h-[36px] bg-panel border border-line hover:bg-surface-2 text-ink rounded-xl text-xs font-bold transition-colors"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(200)}
                  className="px-3 py-2 min-h-[36px] bg-panel border border-line hover:bg-surface-2 text-ink rounded-xl text-xs font-bold transition-colors"
                >
                  +200
                </button>
              </div>

              {/* Change Indicator Card: text-bad for blocking deficiency, text-ok for change */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  change >= 0
                    ? 'bg-ok-soft border-ok/30 text-ok'
                    : 'bg-bad-soft border-bad/30 text-bad'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-5 h-5 ${change >= 0 ? 'text-ok' : 'text-bad'}`}
                  />
                  <span className="text-xs font-bold">
                    {change >= 0 ? 'الباقي المستحق للعميل:' : 'عجز في المبلغ المستلم (نقص):'}
                  </span>
                </div>
                <span
                  className={`text-xl font-black ${
                    change >= 0 ? 'text-ok' : 'text-bad'
                  }`}
                >
                  {formatCurrency(Math.abs(change))}
                </span>
              </div>
            </div>
          )}

          {/* Electronic Details (InstaPay & Vodafone Cash reference) */}
          {(method === PaymentMethod.INSTAPAY || method === PaymentMethod.VODAFONE_CASH || method === PaymentMethod.CARD) && (
            <div className="bg-surface-1/60 p-4 rounded-2xl border border-line space-y-2">
              <label className="text-xs font-bold text-ink">
                {method === PaymentMethod.INSTAPAY && 'بيانات تحويل إنستاباي (رقم العملية / الحساب المحول منه):'}
                {method === PaymentMethod.VODAFONE_CASH && 'رقم محفظة فودافون كاش / كود العملية:'}
                {method === PaymentMethod.CARD && 'رقم إيصال ماكينة الفيزا POS (اختياري):'}
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="رقم مرجعي للمطابقة..."
                className="w-full px-3.5 py-2.5 bg-panel border border-line rounded-xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}

          {/* Split Payment Builder */}
          {method === PaymentMethod.SPLIT && (
            <div className="bg-surface-1/60 p-4 rounded-2xl border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">توزيع مبالغ الدفع على القنوات:</span>
                <span className="text-[11px] text-muted font-bold">المطلوب: {formatCurrency(totalAmount)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Split Cash */}
                <div className="p-2.5 bg-panel rounded-xl border border-line space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-ok">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" /> نقدي (كاش)
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitCash(String(splitRemaining + (Number(splitCash) || 0)))}
                        className="text-2xs text-brand hover:underline font-bold"
                      >
                        المتبقي
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm font-bold px-2 py-1.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                {/* Split Card */}
                <div className="p-2.5 bg-panel rounded-xl border border-line space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-brand-ink">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> بطاقة / فيزا
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitCard(String(splitRemaining + (Number(splitCard) || 0)))}
                        className="text-2xs text-brand hover:underline font-bold"
                      >
                        المتبقي
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm font-bold px-2 py-1.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                {/* Split InstaPay */}
                <div className="p-2.5 bg-panel rounded-xl border border-line space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-info">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> إنستاباي
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitInstapay(String(splitRemaining + (Number(splitInstapay) || 0)))}
                        className="text-2xs text-brand hover:underline font-bold"
                      >
                        المتبقي
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={splitInstapay}
                    onChange={(e) => setSplitInstapay(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm font-bold px-2 py-1.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                {/* Split Vodafone */}
                <div className="p-2.5 bg-panel rounded-xl border border-line space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-warn">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5" /> فودافون كاش
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitVodafone(String(splitRemaining + (Number(splitVodafone) || 0)))}
                        className="text-2xs text-brand hover:underline font-bold"
                      >
                        المتبقي
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={splitVodafone}
                    onChange={(e) => setSplitVodafone(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm font-bold px-2 py-1.5 bg-panel border border-line rounded-lg text-ink focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Split Balance Summary: text-warn for customer credit remainder, text-bad for blocking deficiency */}
              <div className="p-3 bg-panel rounded-xl border border-line flex items-center justify-between text-xs font-bold">
                <div>
                  <span className="text-muted block text-[11px]">المسدد الآن:</span>
                  <span className="text-ink text-sm font-bold">{formatCurrency(splitTotalPaid)}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted block text-[11px]">
                    {splitRemaining === 0
                      ? 'الحالة:'
                      : splitRemaining > 0
                      ? customer?.id
                        ? 'متبقي على حساب العميل (آجل):'
                        : 'متبقي مطلوب سداده (عجز):'
                      : 'فائض مدفوع:'}
                  </span>
                  <span
                    className={`text-sm font-black ${
                      splitRemaining === 0
                        ? 'text-ok'
                        : splitRemaining > 0
                        ? customer?.id
                          ? 'text-warn'
                          : 'text-bad'
                        : 'text-bad'
                    }`}
                  >
                    {splitRemaining === 0 ? 'مكتمل بالتمام ✓' : formatCurrency(Math.abs(splitRemaining))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Credit Warning if no customer selected */}
          {method === PaymentMethod.CREDIT && !customer?.id && (
            <div className="p-4 bg-warn-soft border border-warn/20 text-warn rounded-2xl text-xs space-y-1">
              <strong className="block font-bold">تنبيه هام:</strong>
              <p>
                لا يمكن إتمام البيع الآجل إلا إذا كان هناك عميل محدد مسجل في النظام لتقييد المديونية عليه.
              </p>
            </div>
          )}

          {/* Salesperson Attribution */}
          {salesStaff.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand" />
                  <span>مسؤول المبيعات / السيلز (لحساب العمولة):</span>
                </span>
                <span className="text-2xs text-muted font-normal">اختياري - افتراضياً الكاشير الحالي</span>
              </label>
              <select
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-panel border border-line rounded-xl text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand font-medium"
              >
                <option value="">-- الكاشير الحالي تلقائياً --</option>
                {salesStaff.map((staff: any) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.role === 'SALES' ? 'سيلز' : staff.role === 'CASHIER' ? 'كاشير' : staff.role === 'MANDOB' ? 'مندوب' : 'مشرف'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">ملاحظات الفاتورة (اختياري):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل إضافية للعملية..."
              className="w-full px-3.5 py-2.5 bg-panel border border-line rounded-xl text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-surface-1 border-t border-line flex flex-col sm:flex-row items-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="w-full sm:flex-1 h-12 rounded-2xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>تأكيد وتسجيل الدفع مع الطباعة (Enter)</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto h-12 px-5 rounded-2xl text-xs font-black transition-colors flex items-center justify-center gap-1.5"
          >
            <span>حفظ فقط بدون طباعة</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
