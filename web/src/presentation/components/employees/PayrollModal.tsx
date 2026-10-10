import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Calendar,
  DollarSign,
  Award,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Coins,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../../../data/api/client';
import { formatCurrency, PaymentMethod } from '@pos-mandob/shared';

interface PayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any | null;
  isOwnerOrAdmin?: boolean;
  isManager?: boolean;
}

export const PayrollModal: React.FC<PayrollModalProps> = ({
  isOpen,
  onClose,
  employee,
}) => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [isAddAdjustmentOpen, setIsAddAdjustmentOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Adjustment Form State
  const [adjType, setAdjType] = useState<'BONUS' | 'DEDUCTION' | 'ADVANCE'>('BONUS');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjReason, setAdjReason] = useState<string>('');
  const [adjDate, setAdjDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Disburse Form State
  const [disburseMethod, setDisburseMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [disburseTreasuryId, setDisburseTreasuryId] = useState<number | ''>('');
  const [disburseNotes, setDisburseNotes] = useState<string>('');

  // 1. Fetch Monthly Payroll Summary
  const { data: payroll, isLoading } = useQuery({
    queryKey: ['payroll', employee?.id, selectedMonth],
    queryFn: async () => {
      if (!employee?.id) return null;
      const res = await apiClient.get(`/payroll/${employee.id}/summary`, {
        params: { month: selectedMonth },
      });
      return res.data?.data;
    },
    enabled: Boolean(isOpen && employee?.id),
  });

  // 2. Fetch Treasuries for Payout
  const { data: treasuriesData } = useQuery({
    queryKey: ['treasuries'],
    queryFn: async () => {
      const res = await apiClient.get('/treasuries');
      return res.data?.data || [];
    },
    enabled: Boolean(isOpen),
  });
  const treasuries: any[] = Array.isArray(treasuriesData) ? treasuriesData : [];

  // 3. Add Adjustment Mutation
  const addAdjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!adjAmount || Number(adjAmount) <= 0) {
        throw new Error('يرجى كتابة مبلغ صحيح');
      }
      return apiClient.post(`/payroll/${employee.id}/adjustments`, {
        type: adjType,
        amount: Number(adjAmount),
        date: adjDate,
        reason: adjReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', employee?.id, selectedMonth] });
      setIsAddAdjustmentOpen(false);
      setAdjAmount('');
      setAdjReason('');
      setFeedback({ type: 'success', message: 'تم تسجيل التسوية المالية بنجاح' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'فشل تسجيل التسوية',
      });
    },
  });

  // 4. Delete Adjustment Mutation
  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (adjustmentId: number) => {
      return apiClient.delete(`/payroll/adjustments/${adjustmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', employee?.id, selectedMonth] });
      setFeedback({ type: 'success', message: 'تم حذف التسوية المالية بنجاح' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'تعذر حذف التسوية',
      });
    },
  });

  // 5. Disburse Payroll Mutation
  const disburseMutation = useMutation({
    mutationFn: async () => {
      if (!disburseTreasuryId) {
        throw new Error('يرجى اختيار الخزينة أو الحساب البنكي المراد الخصم منه');
      }
      return apiClient.post(`/payroll/${employee.id}/disburse`, {
        month: selectedMonth,
        treasury_id: Number(disburseTreasuryId),
        payment_method: disburseMethod,
        notes: disburseNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', employee?.id, selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDisburseOpen(false);
      setFeedback({ type: 'success', message: 'تم صرف الراتب وخصمه من الخزينة بنجاح! 🎉' });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'فشل إتمام صرف الراتب',
      });
    },
  });

  if (!isOpen || !employee) return null;

  const isPaid = Boolean(payroll?.is_paid);
  const netPayable = payroll?.net_payable || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-black text-lg shadow-inner">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">{employee.name}</h3>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                  {employee.role === 'SALES'
                    ? 'بائع صالة / سيلز'
                    : employee.role === 'CASHIER'
                    ? 'كاشير'
                    : employee.role === 'MANDOB'
                    ? 'مندوب مبيعات'
                    : employee.role === 'MANAGER'
                    ? 'مدير فرع'
                    : 'مشرف'}
                </span>
                {employee.branch && (
                  <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                    {employee.branch.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">مسير الراتب الشهري وعمولات المبيعات والتسويات</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={clsx(
              'px-5 py-2.5 text-xs font-bold flex items-center gap-2 border-b',
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            )}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Month Selector Bar */}
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">شهر المسير:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            {isPaid ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>تم صرف الراتب ✓</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>معلق (بانتظار الصرف)</span>
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
              <span className="text-xs font-bold">جاري احتساب المسير والعمولات...</span>
            </div>
          ) : (
            <>
              {/* Financial Capsules Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Base Salary */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 text-center">
                  <span className="text-[11px] text-slate-500 font-bold block">الراتب الأساسي</span>
                  <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                    {formatCurrency(payroll?.base_salary || 0)}
                  </span>
                </div>

                {/* Commission */}
                <div className="bg-primary-50/60 p-3 rounded-2xl border border-primary-100 text-center relative overflow-hidden">
                  <span className="text-[11px] text-primary-700 font-bold block flex items-center justify-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>العمولة المستحقة</span>
                  </span>
                  <span className="text-base font-black text-primary-900 font-mono block mt-0.5">
                    +{formatCurrency(payroll?.commission_amount || 0)}
                  </span>
                  <span className="text-[9px] text-primary-600/80 block mt-0.5">
                    {payroll?.is_manager_scope ? 'مبيعات الفرع المباشرة' : 'المبيعات الشخصية'}: {formatCurrency(payroll?.total_sales || 0)}
                  </span>
                </div>

                {/* Bonuses */}
                <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-100 text-center">
                  <span className="text-[11px] text-teal-700 font-bold block">إضافي ومكافآت</span>
                  <span className="text-base font-black text-teal-900 font-mono block mt-0.5">
                    +{formatCurrency(payroll?.total_bonuses || 0)}
                  </span>
                </div>

                {/* Deductions */}
                <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-100 text-center">
                  <span className="text-[11px] text-rose-700 font-bold block">خصومات وسلف</span>
                  <span className="text-base font-black text-rose-900 font-mono block mt-0.5">
                    -{formatCurrency(payroll?.total_deductions || 0)}
                  </span>
                </div>
              </div>

              {/* Grand Total Capsule (Net Payable) */}
              <div
                className={clsx(
                  'p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-white shadow-sm',
                  isPaid ? 'bg-gradient-to-r from-slate-900 to-slate-800' : 'bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900'
                )}
              >
                <div>
                  <span className="text-xs text-emerald-200/90 block">
                    {isPaid ? 'المبلغ الذي تم صرفه فعلياً:' : 'صافي الراتب المستحق للصرف:'}
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black font-mono tracking-tight text-white">
                      {formatCurrency(netPayable)}
                    </span>
                    <span className="text-xs text-emerald-300 font-bold">
                      {isPaid ? '(تم الصرف)' : '(الأساسي + العمولة + الإضافي - الخصم)'}
                    </span>
                  </div>
                </div>

                <div>
                  {!isPaid ? (
                    <button
                      type="button"
                      onClick={() => setIsDisburseOpen(true)}
                      disabled={netPayable <= 0}
                      className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 disabled:opacity-50 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <Coins className="w-4 h-4" />
                      <span>صرف الراتب الآن 💸</span>
                    </button>
                  ) : (
                    <div className="text-right text-xs text-emerald-200">
                      <div>طريقة الصرف: <strong className="text-white">{payroll?.payout?.payment_method}</strong></div>
                      <div>الخزينة: <strong className="text-white">{payroll?.payout?.treasury?.name || 'الخزينة العامة'}</strong></div>
                      <div className="text-[11px] text-slate-300 mt-0.5">بواسطة: {payroll?.payout?.paid_by_name}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Adjustments Section (الخصومات والمكافآت) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-slate-900">سجل التسويات والبدلات لهذا الشهر</h4>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                      {payroll?.adjustments?.length || 0}
                    </span>
                  </div>

                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => setIsAddAdjustmentOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-bold transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مكافأة أو خصم</span>
                    </button>
                  )}
                </div>

                {payroll?.adjustments?.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                    لا توجد أي خصومات أو مكافآت مسجلة لهذا الموظف في هذا الشهر.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                    {payroll?.adjustments?.map((adj: any) => (
                      <div key={adj.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-black',
                              adj.type === 'BONUS'
                                ? 'bg-teal-100 text-teal-800'
                                : adj.type === 'ADVANCE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            )}
                          >
                            {adj.type === 'BONUS' ? 'مكافأة / إضافي' : adj.type === 'ADVANCE' ? 'سلفة' : 'خصم / جزاء'}
                          </span>
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {adj.reason || (adj.type === 'BONUS' ? 'إضافي بدون سبب' : 'خصم بدون سبب')}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {adj.date} • بواسطة: {adj.created_by_name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={clsx(
                              'font-black font-mono text-sm',
                              adj.type === 'BONUS' ? 'text-teal-700' : 'text-rose-700'
                            )}
                          >
                            {adj.type === 'BONUS' ? '+' : '-'}{formatCurrency(adj.amount)}
                          </span>

                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا البند؟')) {
                                  deleteAdjustmentMutation.mutate(adj.id);
                                }
                              }}
                              className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                              title="حذف التسوية"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sub-Modal: Add Adjustment */}
      {isAddAdjustmentOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900">تسجيل تسوية مالية</h4>
              <button onClick={() => setIsAddAdjustmentOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع التسوية:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAdjType('BONUS')}
                    className={clsx(
                      'py-2 rounded-xl text-xs font-bold border transition-all',
                      adjType === 'BONUS'
                        ? 'bg-teal-50 border-teal-500 text-teal-800 ring-1 ring-teal-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    مكافأة (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('DEDUCTION')}
                    className={clsx(
                      'py-2 rounded-xl text-xs font-bold border transition-all',
                      adjType === 'DEDUCTION'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    خصم (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('ADVANCE')}
                    className={clsx(
                      'py-2 rounded-xl text-xs font-bold border transition-all',
                      adjType === 'ADVANCE'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    سلفة (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ *</label>
                <input
                  type="date"
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السبب / البيان</label>
                <input
                  type="text"
                  placeholder="مثال: حافز تميز في مبيعات نهاية الأسبوع"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddAdjustmentOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => addAdjustmentMutation.mutate()}
                  disabled={addAdjustmentMutation.isPending || !adjAmount}
                  className="px-5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 disabled:opacity-50"
                >
                  {addAdjustmentMutation.isPending ? 'جاري الحفظ...' : 'حفظ التسوية'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal: Disburse Payroll (صرف الراتب بمرونة الدفع) */}
      {isDisburseOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">تأكيد صرف راتب شهر {selectedMonth}</h4>
                  <span className="text-xs text-slate-400">للموظف: {employee.name}</span>
                </div>
              </div>
              <button onClick={() => setIsDisburseOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total to pay banner */}
            <div className="bg-emerald-900 text-white p-3.5 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-emerald-200">إجمالي المبلغ المصروف:</span>
              <span className="text-xl font-black font-mono">{formatCurrency(netPayable)}</span>
            </div>

            <div className="space-y-3">
              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع والتسليم:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.CASH)}
                    className={clsx(
                      'py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center',
                      disburseMethod === PaymentMethod.CASH
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    نقدي (كاش)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.TRANSFER)}
                    className={clsx(
                      'py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center',
                      disburseMethod === PaymentMethod.TRANSFER
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    تحويل بنكي
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.INSTAPAY)}
                    className={clsx(
                      'py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center',
                      disburseMethod === PaymentMethod.INSTAPAY
                        ? 'bg-purple-50 border-purple-500 text-purple-800 ring-1 ring-purple-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    إنستاباي ⚡
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.VODAFONE_CASH)}
                    className={clsx(
                      'py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center',
                      disburseMethod === PaymentMethod.VODAFONE_CASH
                        ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500/30'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}
                  >
                    محفظة كاش
                  </button>
                </div>
              </div>

              {/* Treasury Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الخزينة أو الحساب المالي المراد الخصم منه: *
                </label>
                <select
                  value={disburseTreasuryId}
                  onChange={(e) => setDisburseTreasuryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">-- اختر الخزينة أو الحساب البنكي --</option>
                  {treasuries
                    .filter((t: any) => t.is_active)
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({formatCurrency(t.balance)})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  سيتم تسجيل عملية صرف رسمية وخصم المبلغ فورياً من رصيد الخزينة، وتسجيل قيد مصروف تحت بند "رواتب وأجور".
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الصرف (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: تم تسليم الراتب يداً بيد / إيصال تحويل رقم 123"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDisburseOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => disburseMutation.mutate()}
                  disabled={disburseMutation.isPending || !disburseTreasuryId}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {disburseMutation.isPending ? 'جاري تسجيل الصرف...' : 'تأكيد الصرف وتنزيل الرصيد ✓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
