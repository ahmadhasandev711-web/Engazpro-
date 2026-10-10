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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-black text-slate-900">إتمام عملية البيع والتحصيل</h3>
            <p className="text-xs text-slate-500">
              العميل: <strong className="text-slate-800">{customer?.name || 'نقدي (عميل كاش)'}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Total Amount Banner */}
          <div className="bg-slate-100 border-2 border-slate-200/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-600 block mb-0.5">إجمالي الفاتورة المطلوب:</span>
              <span className="text-3xl font-black font-mono text-slate-950 tracking-tight">{formatCurrency(totalAmount)}</span>
            </div>
            {customer && (
              <div className="text-right">
                <span className="text-[11px] font-medium text-slate-500 block mb-0.5">حساب العميل:</span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 rounded-lg inline-block">مسجل بالنظام ✓</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">طريقة الدفع والتحصيل:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Cash */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.CASH);
                  setReceivedAmount(totalAmount);
                }}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  method === PaymentMethod.CASH
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Coins className="w-5 h-5 text-emerald-600" />
                <span>نقدي (كاش)</span>
              </button>

              {/* Card / Visa */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.CARD);
                  setReceivedAmount(totalAmount);
                }}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  method === PaymentMethod.CARD
                    ? 'bg-primary-50 border-primary-500 text-primary-800 ring-2 ring-primary-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-5 h-5 text-primary-600" />
                <span>بطاقة / فيزا</span>
              </button>

              {/* InstaPay */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.INSTAPAY);
                  setReceivedAmount(totalAmount);
                }}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  method === PaymentMethod.INSTAPAY
                    ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Zap className="w-5 h-5 text-purple-600" />
                <span>إنستاباي (InstaPay)</span>
              </button>

              {/* Vodafone Cash */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.VODAFONE_CASH);
                  setReceivedAmount(totalAmount);
                }}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  method === PaymentMethod.VODAFONE_CASH
                    ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-5 h-5 text-rose-600" />
                <span>فودافون كاش ومحافظ</span>
              </button>

              {/* Credit / On Account */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.CREDIT);
                  setReceivedAmount(0);
                }}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  method === PaymentMethod.CREDIT
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CalendarClock className="w-5 h-5 text-amber-600" />
                <span>آجل (على الحساب)</span>
              </button>

              {/* Split Payment */}
              <button
                type="button"
                onClick={() => {
                  setMethod(PaymentMethod.SPLIT);
                  setReceivedAmount(totalAmount);
                }}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  method === PaymentMethod.SPLIT
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>دفع مجزأ (متعدد)</span>
              </button>
            </div>
          </div>

          {/* Cash Details & Change Calculator */}
          {method === PaymentMethod.CASH && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                  <span>المبلغ المستلم من العميل نقداً باليد:</span>
                  <span className="text-slate-400 font-normal">المطلوب: {formatCurrency(totalAmount)}</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className="w-full text-2xl font-black font-mono pl-14 pr-4 py-3 bg-white border-2 border-slate-300 focus:border-primary-500 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-100 transition-all shadow-xs"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ج.م
                  </span>
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setReceivedAmount(totalAmount)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  بالضبط
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(10)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(20)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  +20
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(50)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(100)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(200)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  +200
                </button>
              </div>

              {/* Change Indicator Card */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  change >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-5 h-5 ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  />
                  <span className="text-xs font-bold">
                    {change >= 0 ? 'الباقي المستحق للعميل:' : 'متبقي على العميل (عجز):'}
                  </span>
                </div>
                <span
                  className={`text-xl font-black font-mono ${
                    change >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(Math.abs(change))}
                </span>
              </div>
            </div>
          )}

          {/* Electronic Details (InstaPay & Vodafone Cash reference) */}
          {(method === PaymentMethod.INSTAPAY || method === PaymentMethod.VODAFONE_CASH || method === PaymentMethod.CARD) && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700">
                {method === PaymentMethod.INSTAPAY && 'بيانات تحويل إنستاباي (رقم العملية / الحساب المحول منه):'}
                {method === PaymentMethod.VODAFONE_CASH && 'رقم محفظة فودافون كاش / كود العملية:'}
                {method === PaymentMethod.CARD && 'رقم إيصال ماكينة الفيزا POS (اختياري):'}
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="رقم مرجعي للمطابقة..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Split Payment Builder */}
          {method === PaymentMethod.SPLIT && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">توزيع مبالغ الدفع على القنوات:</span>
                <span className="text-[11px] font-mono text-slate-500">المطلوب: {formatCurrency(totalAmount)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Split Cash */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" /> نقدي (كاش)
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitCash(String(splitRemaining + (Number(splitCash) || 0)))}
                        className="text-[10px] text-primary-600 hover:underline"
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
                    className="w-full text-sm font-bold font-mono px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* Split Card */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-primary-700">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> بطاقة / فيزا
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitCard(String(splitRemaining + (Number(splitCard) || 0)))}
                        className="text-[10px] text-primary-600 hover:underline"
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
                    className="w-full text-sm font-bold font-mono px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* Split InstaPay */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-700">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> إنستاباي
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitInstapay(String(splitRemaining + (Number(splitInstapay) || 0)))}
                        className="text-[10px] text-primary-600 hover:underline"
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
                    className="w-full text-sm font-bold font-mono px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* Split Vodafone */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-700">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5" /> فودافون كاش
                    </span>
                    {splitRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSplitVodafone(String(splitRemaining + (Number(splitVodafone) || 0)))}
                        className="text-[10px] text-primary-600 hover:underline"
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
                    className="w-full text-sm font-bold font-mono px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Split Balance Summary */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold">
                <div>
                  <span className="text-slate-500 block text-[11px]">المسدد الآن:</span>
                  <span className="text-slate-900 font-mono text-sm">{formatCurrency(splitTotalPaid)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">
                    {splitRemaining === 0
                      ? 'الحالة:'
                      : splitRemaining > 0
                      ? 'متبقي (آجل):'
                      : 'فائض مدفوع:'}
                  </span>
                  <span
                    className={`font-mono text-sm ${
                      splitRemaining === 0
                        ? 'text-emerald-600'
                        : splitRemaining > 0
                        ? customer?.id
                          ? 'text-amber-600'
                          : 'text-rose-600'
                        : 'text-rose-600'
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
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
              <strong className="block font-bold">تنبيه هام:</strong>
              <p>
                لا يمكن إتمام البيع الآجل إلا إذا كان هناك عميل محدد مسجل في النظام لتقييد المديونية عليه.
              </p>
            </div>
          )}

          {/* Salesperson Attribution */}
          {salesStaff.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-primary-600" />
                  <span>مسؤول المبيعات / السيلز (لحساب العمولة):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">اختياري - افتراضياً الكاشير الحالي</span>
              </label>
              <select
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
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
            <label className="text-xs font-bold text-slate-700">ملاحظات الفاتورة (اختياري):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل إضافية للعملية..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-emerald-700/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد وطباعة الإيصال (Enter)'}</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <span>حفظ فقط بدون طباعة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
