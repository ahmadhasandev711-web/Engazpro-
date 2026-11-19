import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, ArrowDownLeft, ArrowUpRight, AlertCircle, X, CheckCircle2, Receipt, Printer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PaymentSchema, PaymentInput, PaymentMethod, formatCurrency, getPaymentMethodLabel } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { fetchPartySelectOptions } from '../../data/api/asyncOptionLoaders';
import { REFERENCE_QUERY_OPTIONS } from '../../data/api/queryPresets';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePermissions } from '../../hooks/usePermissions';
import { DateRangeFilter, calculatePresetDates } from '../components/common/DateRangeFilter';
import { PaginationBar } from '../components/common/PaginationBar';
import { PaymentMobileCard } from '../components/mobile/PaymentMobileCard';
import { PaymentReceiptModal, PaymentReceiptData } from '../components/payments/PaymentReceiptModal';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useConfirm } from '../context/ConfirmContext';
import { AsyncSearchSelect, Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Tabs, Textarea, TabItem } from '../components/ui';

export const PaymentsPage: React.FC = () => {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const { canDeletePayment, canViewEmployeePaymentsScope, isCashier, isMandob } = usePermissions();
  const isCashRestrictedEmployee = isCashier || isMandob;
  const initialDates = calculatePresetDates('today');
  const [activeTab, setActiveTab] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>('ALL');
  const [paymentPartyScope, setPaymentPartyScope] = useState<'SUPPLIER,COURIER' | 'SUPPLIER' | 'COURIER'>('SUPPLIER,COURIER');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [page, setPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPrintPayment, setSelectedPrintPayment] = useState<PaymentReceiptData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hardware back button listener for modal
  useEffect(() => {
    if (!isModalOpen && !selectedPrintPayment) return;
    return nativeBackButton.register(() => {
      if (selectedPrintPayment) {
        setSelectedPrintPayment(null);
        return true;
      }
      setIsModalOpen(false);
      return true;
    });
  }, [isModalOpen, selectedPrintPayment]);

  const { data: employeesData } = useQuery({
    queryKey: ['employees-filter'],
    queryFn: async () => {
      const res = await apiClient.get('/employees');
      return res.data?.data || [];
    },
    enabled: canViewEmployeePaymentsScope,
    ...REFERENCE_QUERY_OPTIONS,
  });

  // Form for new voucher
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentInput>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: {
      type: 'RECEIPT',
      amount: 0,
      method: PaymentMethod.CASH,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const selectedType = watch('type');

  // Queries
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', activeTab, selectedEmployeeId, debouncedSearch, fromDate, toDate, page],
    queryFn: async () => {
      const res = await apiClient.get('/payments', {
        params: {
          type: activeTab === 'ALL' ? undefined : activeTab,
          created_by: selectedEmployeeId || undefined,
          search: debouncedSearch || undefined,
          date_from: fromDate || undefined,
          date_to: toDate || undefined,
          page,
        },
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const targetPartyType = selectedType === 'RECEIPT' ? 'CUSTOMER' : paymentPartyScope;
  const isEmployeeCashOnlyPayment = isCashRestrictedEmployee && selectedType === 'PAYMENT';
  const selectedPartyId = watch('party_id');

  const payments = paymentsData?.data || [];
  const meta = paymentsData?.meta;
  const summary = paymentsData?.summary;

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: PaymentInput) => {
      return apiClient.post('/payments', data);
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      setIsModalOpen(false);
      reset();
      if (res?.data?.data) {
        setSelectedPrintPayment(res.data.data);
      }
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'حدث خطأ أثناء حفظ السند');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر إلغاء السند');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'تأكيد إلغاء السند',
      message: 'هل أنت متأكد من إلغاء هذا السند؟ سيتم عكس القيد المحاسبي المرتبط به في كشف الحساب فورياً.',
      type: 'danger',
    });
    if (ok) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: PaymentInput) => {
    setErrorMessage(null);
    createMutation.mutate(data);
  };

  const filteredPayments = payments;

  const paymentTabs: TabItem[] = [
    { id: 'ALL', label: 'جميع السندات', count: meta?.total ?? payments.length },
    { id: 'RECEIPT', label: 'سندات قبض' },
    { id: 'PAYMENT', label: 'سندات صرف' },
  ];

  const totalReceiptsAmount = summary?.total_receipts ?? filteredPayments
    .filter((p: any) => p.type === 'RECEIPT')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const totalPaymentsAmount = summary?.total_payments ?? filteredPayments
    .filter((p: any) => p.type === 'PAYMENT')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Desktop Header (hidden on mobile) */}
      <div className="hidden md:block">
        <PageHeader
          title="سندات القبض والدفع"
          description="إدارة المقبوضات النقدية من العملاء والمدفوعات للموردين وشركات الشحن لتسوية الأرصدة"
          className="mb-0"
          actions={
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setErrorMessage(null);
                reset({
                  type: 'RECEIPT',
                  amount: 0,
                  method: PaymentMethod.CASH,
                  date: new Date().toISOString().split('T')[0],
                  notes: '',
                });
                setIsModalOpen(true);
              }}
              className="text-sm font-bold"
            >
              إضافة سند جديد
            </Button>
          }
        />
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden p-3.5 flex items-center justify-between border-ok/30 bg-ok-soft/40">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-muted">
            <Receipt className="w-3.5 h-3.5 text-ok" />
            <span>سندات الحركة ({meta?.total ?? filteredPayments.length})</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <div>
              <span className="text-[10px] text-muted block">المقبوض</span>
              <span className="text-lg font-black tracking-tight tabular-nums text-ok">
                {formatCurrency(totalReceiptsAmount)}
              </span>
            </div>
            <div className="border-r border-line pr-3">
              <span className="text-[10px] text-muted block">المنصرف</span>
              <span className="text-base font-bold tabular-nums text-bad">
                {formatCurrency(totalPaymentsAmount)}
              </span>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setErrorMessage(null);
            reset({
              type: 'RECEIPT',
              amount: 0,
              method: PaymentMethod.CASH,
              date: new Date().toISOString().split('T')[0],
              notes: '',
            });
            setIsModalOpen(true);
          }}
          className="text-xs font-black px-3"
        >
          سند جديد
        </Button>
      </Card>

      {errorMessage && (
        <div className="p-4 bg-bad-soft border border-bad/20 text-bad text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-bad flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs, Search & Date Filters */}
      <Card className="flex flex-col gap-2.5 p-3 sm:p-4 rounded-2xl w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="w-full sm:w-auto min-w-0">
            <Tabs
              tabs={paymentTabs}
              activeTab={activeTab}
              onChange={(id) => {
                setActiveTab(id as 'ALL' | 'RECEIPT' | 'PAYMENT');
                setPage(1);
              }}
            />
          </div>

          {/* Search Input */}
          <div className="flex-1 sm:max-w-xs">
            <Input
              type="text"
              placeholder="بحث بالاسم أو البيان أو رقم السند..."
              value={search}
              leftIcon={<Search className="w-4 h-4" />}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {canViewEmployeePaymentsScope && (
            <div className="sm:w-52">
              <Select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-medium"
              >
                <option value="">جميع المحصلين (الكل)</option>
                {employeesData?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role === 'MANDOB' ? 'مندوب' : emp.role === 'CASHIER' ? 'كاشير' : emp.role === 'MANAGER' ? 'مدير' : 'مشرف'})
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Date Range Filter Bar */}
        <div className="pt-2 border-t border-line w-full min-w-0 max-w-full overflow-hidden">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            defaultPreset="today"
            onChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="flex-1 rounded-xl p-0 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted font-medium flex-1">جاري التحميل...</div>
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title="لا توجد سندات مسجلة"
            description={'انقر فوق زر "إضافة سند جديد" لتسجيل سند قبض أو صرف وتحديث الحسابات.'}
            className="flex-1 border-0 rounded-none py-16"
          />
        ) : (
          <>
            {/* Desktop Table View (Hidden on Mobile) */}
            <div className="hidden md:block flex-1">
              <DataTable className="border-0 rounded-none shadow-none">
                <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
                  <tr>
                    <th className="py-3.5 px-4">رقم السند</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">النوع</th>
                    <th className="py-3.5 px-4">الطرف</th>
                    {canViewEmployeePaymentsScope && <th className="py-3.5 px-4">المحصّل / المنشئ</th>}
                    <th className="py-3.5 px-4">المبلغ</th>
                    <th className="py-3.5 px-4">طريقة الدفع</th>
                    <th className="py-3.5 px-4">البيان / ملاحظات</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredPayments.map((p: any) => {
                    const isReceipt = p.type === 'RECEIPT';
                    return (
                      <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-3.5 px-4 tabular-nums font-bold text-ink">#{p.id}</td>
                        <td className="py-3.5 px-4 text-muted tabular-nums">{p.date}</td>
                        <td className="py-3.5 px-4">
                          <Badge tone={isReceipt ? 'ok' : 'bad'}>
                            {isReceipt ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            <span>{isReceipt ? 'سند قبض' : 'سند صرف'}</span>
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-ink">{p.party_name || 'بدون طرف'}</td>
                        {canViewEmployeePaymentsScope && (
                          <td className="py-3.5 px-4 text-xs">
                            {p.created_by_name ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-ink">{p.created_by_name}</span>
                                <span className="text-[10px] text-muted font-medium">
                                  {p.created_by_role === 'MANDOB' ? 'مندوب مبيعات' :
                                   p.created_by_role === 'CASHIER' ? 'كاشير' :
                                   p.created_by_role === 'MANAGER' ? 'مدير الفرع' :
                                   p.created_by_role === 'SUPERVISOR' ? 'مشرف' : 'المالك'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        )}
                        <td className={`py-3.5 px-4 font-black tabular-nums ${isReceipt ? 'text-ok' : 'text-bad'}`}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-muted">
                          {getPaymentMethodLabel(p.method)}
                        </td>
                        <td className="py-3.5 px-4 text-muted max-w-xs truncate">{p.notes || '-'}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedPrintPayment(p)}
                              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-brand rounded-xl hover:bg-surface-2 transition-colors"
                              title="طباعة / مشاركة إيصال السند"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {canDeletePayment && (
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id)}
                                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-bad rounded-xl hover:bg-bad-soft transition-colors"
                                title="إلغاء السند"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>

            {/* Mobile Cards View (Touch-Optimized) */}
            <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3 bg-surface-2">
              {filteredPayments.map((p: any) => (
                <PaymentMobileCard
                  key={p.id}
                  payment={p}
                  isOwner={canViewEmployeePaymentsScope}
                  canDelete={canDeletePayment}
                  onDelete={handleDelete}
                  onPrint={(payment) => setSelectedPrintPayment(payment)}
                />
              ))}
            </div>

            <PaginationBar
              currentPage={meta?.current_page || page}
              lastPage={meta?.last_page || 1}
              total={meta?.total || filteredPayments.length}
              perPage={meta?.per_page || 20}
              onPageChange={(newPage) => setPage(newPage)}
              itemLabel="سند"
            />
          </>
        )}
      </Card>

      {/* Add Voucher Modal - Responsive Bottom Sheet on Mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel border border-line w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mt-3 sm:hidden" />
            <div className="p-5 border-b border-line flex items-center justify-between bg-surface">
              <h3 className="font-bold text-base text-ink">تسجيل سند جديد</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-bad-soft border border-bad/20 text-bad text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-bad flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">نوع السند</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setValue('type', 'RECEIPT');
                      setValue('party_id', undefined as any);
                    }}
                    className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedType === 'RECEIPT'
                        ? 'bg-ok-soft border-ok text-ok'
                        : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    قبض من عميل 🟢
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setValue('type', 'PAYMENT');
                      setValue('party_id', undefined as any);
                      if (isCashRestrictedEmployee) {
                        setValue('method', PaymentMethod.CASH);
                      }
                    }}
                    className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedType === 'PAYMENT'
                        ? 'bg-bad-soft border-bad text-bad'
                        : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    صرف لمورد / شحن 🔴
                  </button>
                </div>
              </div>

              {selectedType === 'PAYMENT' && (
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">الجهة المستفيدة من الصرف</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'SUPPLIER,COURIER', label: 'الكل' },
                      { id: 'SUPPLIER', label: 'مورد' },
                      { id: 'COURIER', label: 'شركة شحن' },
                    ].map((scopeOption) => (
                      <button
                        key={scopeOption.id}
                        type="button"
                        onClick={() => {
                          setPaymentPartyScope(scopeOption.id as 'SUPPLIER,COURIER' | 'SUPPLIER' | 'COURIER');
                          setValue('party_id', undefined as any);
                        }}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-colors ${
                          paymentPartyScope === scopeOption.id
                            ? 'bg-brand-soft border-brand text-brand-ink'
                            : 'border-line text-muted hover:bg-surface-2 hover:text-ink'
                        }`}
                      >
                        {scopeOption.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Party Select */}
              <AsyncSearchSelect
                required
                allowClear={false}
                label={selectedType === 'RECEIPT' ? 'العميل المستلم منه *' : 'المورد أو شركة الشحن المدفوع لها *'}
                placeholder="-- اختر الطرف --"
                searchPlaceholder="ابحث بالاسم أو رقم الهاتف..."
                value={selectedPartyId}
                error={errors.party_id?.message}
                queryKeyPrefix={['payment-parties', targetPartyType]}
                loadOptions={(term) => fetchPartySelectOptions(targetPartyType, term, true)}
                onChange={(opt) =>
                  setValue('party_id', (opt ? Number(opt.value) : undefined) as any, {
                    shouldValidate: true,
                  })
                }
              />

              {/* Amount & Method */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="المبلغ (ج.م) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  error={errors.amount?.message}
                  className="font-bold tabular-nums"
                  {...register('amount', { valueAsNumber: true })}
                />
                <Select
                  label="طريقة الدفع"
                  disabled={isEmployeeCashOnlyPayment}
                  {...register('method')}
                >
                  <option value={PaymentMethod.CASH}>نقدًا (كاش)</option>
                  {!isEmployeeCashOnlyPayment && (
                    <>
                      <option value={PaymentMethod.CARD}>بطاقة / فيزا</option>
                      <option value={PaymentMethod.INSTAPAY}>إنستاباي (InstaPay)</option>
                      <option value={PaymentMethod.VODAFONE_CASH}>فودافون كاش ومحافظ إلكترونية</option>
                      <option value={PaymentMethod.TRANSFER}>تحويل بنكي</option>
                    </>
                  )}
                </Select>
              </div>
              {isEmployeeCashOnlyPayment && (
                <p className="text-[11px] text-warn font-medium -mt-2">
                  سندات الصرف للموظف تُخصم نقداً (كاش) فقط من رصيد الدرج / العهدة الحالي.
                </p>
              )}

              {/* Date */}
              <Input
                label="التاريخ *"
                type="date"
                {...register('date')}
              />

              {/* Notes */}
              <Textarea
                label="البيان / ملاحظات (اختياري)"
                rows={2}
                placeholder="مثال: دفعة تحت الحساب عن فاتورة رقم..."
                {...register('notes')}
              />

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  className="text-sm font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={createMutation.isPending}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  className="text-sm font-bold"
                >
                  {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ السند'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Voucher Receipt Modal (74mm Thermal & WhatsApp) */}
      <PaymentReceiptModal
        isOpen={Boolean(selectedPrintPayment)}
        onClose={() => setSelectedPrintPayment(null)}
        payment={selectedPrintPayment}
      />
    </div>
  );
};
