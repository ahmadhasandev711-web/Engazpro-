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
import { useConfirm } from '../../context/ConfirmContext';
import { Badge, Button, Input, Select } from '../ui';
import { getEmployeeRoleMeta } from './employeeRoleMap';

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
  const { confirm } = useConfirm();
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
      setFeedback({ type: 'success', message: 'تم صرف الراتب وخصمه من الخزينة بنجاح!' });
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
  const roleMeta = getEmployeeRoleMeta(employee.role);

  const treasuryOptions = [
    { value: '', label: '-- اختر الخزينة أو الحساب البنكي --' },
    ...treasuries
      .filter((t: any) => t.is_active)
      .map((t: any) => ({
        value: String(t.id),
        label: `${t.name} (${formatCurrency(t.balance)})`,
      })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-panel rounded-3xl w-full max-w-2xl shadow-2xl border border-line flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-surface-2/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-ok-soft text-ok border border-ok/20 flex items-center justify-center font-black text-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-ink">{employee.name}</h3>
                <Badge tone={roleMeta.tone} className="text-2xs">
                  {roleMeta.label}
                </Badge>
                {employee.branch && (
                  <Badge tone="brand" className="text-2xs">
                    {employee.branch.name}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">مسير الراتب الشهري وعمولات المبيعات والتسويات</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={clsx(
              'px-5 py-2.5 text-xs font-bold flex items-center gap-2 border-b',
              feedback.type === 'success'
                ? 'bg-ok-soft text-ok border-ok/30'
                : 'bg-bad-soft text-bad border-bad/30'
            )}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-bad flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Month Selector Bar */}
        <div className="px-5 py-3 bg-surface-2/40 border-b border-line flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted" />
            <span className="text-xs font-bold text-ink">شهر المسير:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-xl border border-line text-xs font-bold bg-panel text-ink focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
            />
          </div>

          <div>
            {isPaid ? (
              <Badge tone="ok" className="px-3 py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تم صرف الراتب</span>
              </Badge>
            ) : (
              <Badge tone="warn" dot className="px-3 py-1">
                <span>معلق (بانتظار الصرف)</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-muted gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand" />
              <span className="text-xs font-bold">جاري احتساب المسير والعمولات...</span>
            </div>
          ) : (
            <>
              {/* Financial Capsules Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-surface-2/60 p-3 rounded-2xl border border-line text-center">
                  <span className="text-xs text-muted font-bold block">الراتب الأساسي</span>
                  <span className="text-base font-black text-ink tabular-nums block mt-0.5">
                    {formatCurrency(payroll?.base_salary || 0)}
                  </span>
                </div>

                <div className="bg-brand-soft/60 p-3 rounded-2xl border border-brand/25 text-center relative overflow-hidden">
                  <span className="text-xs text-brand-ink font-bold flex items-center justify-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>العمولة المستحقة</span>
                  </span>
                  <span className="text-base font-black text-brand tabular-nums block mt-0.5">
                    +{formatCurrency(payroll?.commission_amount || 0)}
                  </span>
                  <span className="text-2xs text-muted block mt-0.5">
                    {payroll?.is_manager_scope ? 'مبيعات الفرع المباشرة' : 'المبيعات الشخصية'}:{' '}
                    {formatCurrency(payroll?.total_sales || 0)}
                  </span>
                </div>

                <div className="bg-ok-soft/60 p-3 rounded-2xl border border-ok/25 text-center">
                  <span className="text-xs text-ok font-bold block">إضافي ومكافآت</span>
                  <span className="text-base font-black text-ok tabular-nums block mt-0.5">
                    +{formatCurrency(payroll?.total_bonuses || 0)}
                  </span>
                </div>

                <div className="bg-bad-soft/60 p-3 rounded-2xl border border-bad/25 text-center">
                  <span className="text-xs text-bad font-bold block">خصومات وسلف</span>
                  <span className="text-base font-black text-bad tabular-nums block mt-0.5">
                    -{formatCurrency(payroll?.total_deductions || 0)}
                  </span>
                </div>
              </div>

              {/* Grand Total Capsule (Net Payable) */}
              <div
                className={clsx(
                  'p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border shadow-xs',
                  isPaid
                    ? 'bg-surface-2 border-line text-ink'
                    : 'bg-ok-soft/70 border-ok/40 text-ink'
                )}
              >
                <div>
                  <span className="text-xs text-muted font-bold block">
                    {isPaid ? 'المبلغ الذي تم صرفه فعلياً:' : 'صافي الراتب المستحق للصرف:'}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black tabular-nums tracking-tight text-ok">
                      {formatCurrency(netPayable)}
                    </span>
                    <span className="text-xs text-muted font-bold">
                      {isPaid ? '(تم الصرف)' : '(الأساسي + العمولة + الإضافي - الخصم)'}
                    </span>
                  </div>
                </div>

                <div>
                  {!isPaid ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setIsDisburseOpen(true)}
                      disabled={netPayable <= 0}
                      leftIcon={<Coins className="w-4 h-4" />}
                    >
                      صرف الراتب الآن
                    </Button>
                  ) : (
                    <div className="text-right text-xs text-muted space-y-0.5">
                      <div>
                        طريقة الصرف: <strong className="text-ink">{payroll?.payout?.payment_method}</strong>
                      </div>
                      <div>
                        الخزينة:{' '}
                        <strong className="text-ink">{payroll?.payout?.treasury?.name || 'الخزينة العامة'}</strong>
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        بواسطة: {payroll?.payout?.paid_by_name}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Adjustments Section */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-ink">سجل التسويات والبدلات لهذا الشهر</h4>
                    <Badge tone="neutral" className="text-2xs">
                      {payroll?.adjustments?.length || 0}
                    </Badge>
                  </div>

                  {!isPaid && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAddAdjustmentOpen(true)}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      إضافة مكافأة أو خصم
                    </Button>
                  )}
                </div>

                {payroll?.adjustments?.length === 0 ? (
                  <div className="p-6 text-center bg-surface-2/40 rounded-2xl border border-dashed border-line text-muted text-xs font-medium">
                    لا توجد أي خصومات أو مكافآت مسجلة لهذا الموظف في هذا الشهر.
                  </div>
                ) : (
                  <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden bg-panel shadow-xs">
                    {payroll?.adjustments?.map((adj: any) => (
                      <div
                        key={adj.id}
                        className="p-3 flex items-center justify-between text-xs hover:bg-surface-2/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Badge
                            tone={
                              adj.type === 'BONUS'
                                ? 'ok'
                                : adj.type === 'ADVANCE'
                                ? 'warn'
                                : 'bad'
                            }
                            className="text-2xs"
                          >
                            {adj.type === 'BONUS' ? 'مكافأة / إضافي' : adj.type === 'ADVANCE' ? 'سلفة' : 'خصم / جزاء'}
                          </Badge>
                          <div>
                            <span className="font-bold text-ink block">
                              {adj.reason || (adj.type === 'BONUS' ? 'إضافي بدون سبب' : 'خصم بدون سبب')}
                            </span>
                            <span className="text-2xs text-muted block mt-0.5">
                              {adj.date} • بواسطة: {adj.created_by_name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={clsx(
                              'font-black tabular-nums text-sm',
                              adj.type === 'BONUS' ? 'text-ok' : 'text-bad'
                            )}
                          >
                            {adj.type === 'BONUS' ? '+' : '-'}
                            {formatCurrency(adj.amount)}
                          </span>

                          {!isPaid && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'تأكيد الحذف',
                                  message: 'هل أنت متأكد من رغبتك في حذف هذا البند؟',
                                  type: 'danger',
                                });
                                if (ok) {
                                  deleteAdjustmentMutation.mutate(adj.id);
                                }
                              }}
                              className="p-2 text-muted hover:text-bad hover:bg-bad-soft"
                              title="حذف التسوية"
                              aria-label="حذف التسوية"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm">
          <div className="bg-panel rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-sm font-black text-ink">تسجيل تسوية مالية</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddAdjustmentOpen(false)}
                aria-label="إغلاق"
                className="p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">نوع التسوية:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAdjType('BONUS')}
                    className={clsx(
                      'min-h-[44px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                      adjType === 'BONUS'
                        ? 'bg-ok-soft border-ok text-ok ring-1 ring-ok/30'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    مكافأة (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('DEDUCTION')}
                    className={clsx(
                      'min-h-[44px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                      adjType === 'DEDUCTION'
                        ? 'bg-bad-soft border-bad text-bad ring-1 ring-bad/30'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    خصم (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('ADVANCE')}
                    className={clsx(
                      'min-h-[44px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                      adjType === 'ADVANCE'
                        ? 'bg-warn-soft border-warn text-warn ring-1 ring-warn/30'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    سلفة (-)
                  </button>
                </div>
              </div>

              <Input
                label="المبلغ (ج.م) *"
                type="number"
                min="1"
                step="any"
                placeholder="0.00"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                className="tabular-nums font-bold"
              />

              <Input
                label="التاريخ *"
                type="date"
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
              />

              <Input
                label="السبب / البيان"
                type="text"
                placeholder="مثال: حافز تميز في مبيعات نهاية الأسبوع"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button type="button" variant="ghost" size="md" onClick={() => setIsAddAdjustmentOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => addAdjustmentMutation.mutate()}
                  isLoading={addAdjustmentMutation.isPending}
                  disabled={addAdjustmentMutation.isPending || !adjAmount}
                >
                  حفظ التسوية
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal: Disburse Payroll */}
      {isDisburseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm">
          <div className="bg-panel rounded-3xl w-full max-w-md p-6 shadow-2xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-ok-soft text-ok rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-ink">تأكيد صرف راتب شهر {selectedMonth}</h4>
                  <span className="text-xs text-muted">للموظف: {employee.name}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDisburseOpen(false)}
                aria-label="إغلاق"
                className="p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Total to pay banner */}
            <div className="bg-ok-soft border border-ok/30 text-ink p-3.5 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-muted font-bold">إجمالي المبلغ المصروف:</span>
              <span className="text-xl font-black text-ok tabular-nums">{formatCurrency(netPayable)}</span>
            </div>

            <div className="space-y-3">
              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">طريقة الدفع والتسليم:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.CASH)}
                    className={clsx(
                      'min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer',
                      disburseMethod === PaymentMethod.CASH
                        ? 'bg-ok-soft border-ok text-ok ring-1 ring-ok/30'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    نقدي (كاش)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.TRANSFER)}
                    className={clsx(
                      'min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer',
                      disburseMethod === PaymentMethod.TRANSFER
                        ? 'bg-info-soft border-info text-info ring-1 ring-info/30'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    تحويل بنكي
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.INSTAPAY)}
                    className={clsx(
                      'min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer',
                      disburseMethod === PaymentMethod.INSTAPAY
                        ? 'bg-brand-soft border-brand text-brand-ink ring-1 ring-brand/30'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    إنستاباي
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisburseMethod(PaymentMethod.VODAFONE_CASH)}
                    className={clsx(
                      'min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer',
                      disburseMethod === PaymentMethod.VODAFONE_CASH
                        ? 'bg-bad-soft border-bad text-bad ring-1 ring-bad/30'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    محفظة كاش
                  </button>
                </div>
              </div>

              <Select
                label="الخزينة أو الحساب المالي المراد الخصم منه: *"
                value={String(disburseTreasuryId)}
                onChange={(e) => setDisburseTreasuryId(e.target.value ? Number(e.target.value) : '')}
                options={treasuryOptions}
                helperText='سيتم تسجيل عملية صرف رسمية وخصم المبلغ فورياً من رصيد الخزينة، وتسجيل قيد مصروف تحت بند "رواتب وأجور".'
              />

              <Input
                label="ملاحظات الصرف (اختياري)"
                type="text"
                placeholder="مثال: تم تسليم الراتب يداً بيد / إيصال تحويل رقم 123"
                value={disburseNotes}
                onChange={(e) => setDisburseNotes(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button type="button" variant="ghost" size="md" onClick={() => setIsDisburseOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => disburseMutation.mutate()}
                  isLoading={disburseMutation.isPending}
                  disabled={disburseMutation.isPending || !disburseTreasuryId}
                >
                  تأكيد الصرف وتنزيل الرصيد
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
