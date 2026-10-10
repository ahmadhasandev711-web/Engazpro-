import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, ArrowDownLeft, ArrowUpRight, AlertCircle, X, CheckCircle2, Receipt } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PaymentSchema, PaymentInput, PaymentMethod, Party, formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { DateRangeFilter } from '../components/common/DateRangeFilter';

export const PaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { canDeletePayment, isOwner } = usePermissions();
  const [activeTab, setActiveTab] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>(isOwner ? 'ALL' : 'RECEIPT');
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: employeesData } = useQuery({
    queryKey: ['employees-filter'],
    queryFn: async () => {
      const res = await apiClient.get('/employees');
      return res.data?.data || [];
    },
    enabled: isOwner,
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
    queryKey: ['payments', activeTab, selectedEmployeeId, fromDate, toDate],
    queryFn: async () => {
      const res = await apiClient.get('/payments', {
        params: {
          type: activeTab === 'ALL' ? undefined : activeTab,
          created_by: selectedEmployeeId || undefined,
          date_from: fromDate || undefined,
          date_to: toDate || undefined,
        },
      });
      return res.data;
    },
  });

  const targetPartyType = selectedType === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER';

  const { data: partiesData } = useQuery({
    queryKey: ['parties', targetPartyType],
    queryFn: async () => {
      const res = await apiClient.get('/parties', {
        params: { type: targetPartyType, per_page: 500 },
      });
      return (res.data?.data?.data || res.data?.data || []) as Party[];
    },
  });

  const availableParties = partiesData || [];
  const payments = paymentsData?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: PaymentInput) => {
      return apiClient.post('/payments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsModalOpen(false);
      reset();
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
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر إلغاء السند');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleDelete = (id: number) => {
    if (window.confirm('هل أنت متأكد من إلغاء هذا السند؟ سيتم عكس القيد المحاسبي المرتبط به في كشف الحساب فورياً.')) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: PaymentInput) => {
    setErrorMessage(null);
    createMutation.mutate(data);
  };

  const filteredPayments = payments.filter((p: any) => {
    if (!search) return true;
    return (
      p.party_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.notes?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toString().includes(search)
    );
  });

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Desktop Header (hidden on mobile) */}
      <div className="hidden md:flex sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isOwner ? 'سندات القبض والدفع' : 'سندات القبض (التحصيل)'}
          </h2>
          <p className="text-sm text-slate-500">
            {isOwner
              ? 'إدارة المقبوضات النقدية من العملاء والمدفوعات للموردين لتسوية الأرصدة والمديونيات'
              : 'إدارة المقبوضات والتحصيلات النقدية من العملاء وتحديث حساباتهم بدقة'}
          </p>
        </div>
        <button
          onClick={() => {
            reset({
              type: 'RECEIPT',
              amount: 0,
              method: PaymentMethod.CASH,
              date: new Date().toISOString().split('T')[0],
              notes: '',
            });
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          {!isOwner ? 'إضافة سند قبض جديد' : 'إضافة سند جديد'}
        </button>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-gradient-to-l from-emerald-600 to-teal-700 rounded-2xl p-3.5 text-white shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold opacity-90">
            <Receipt className="w-3.5 h-3.5" />
            <span>سندات الحركة ({filteredPayments.length})</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <div>
              <span className="text-[10px] text-emerald-200 block">المقبوض</span>
              <span className="text-lg font-black tracking-tight">
                {formatCurrency(
                  filteredPayments
                    .filter((p: any) => p.type === 'RECEIPT')
                    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
                )}
              </span>
            </div>
            {isOwner && (
              <div className="border-r border-white/20 pr-3">
                <span className="text-[10px] text-rose-200 block">المنصرف</span>
                <span className="text-base font-bold text-rose-100">
                  {formatCurrency(
                    filteredPayments
                      .filter((p: any) => p.type === 'PAYMENT')
                      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            reset({
              type: 'RECEIPT',
              amount: 0,
              method: PaymentMethod.CASH,
              date: new Date().toISOString().split('T')[0],
              notes: '',
            });
            setIsModalOpen(true);
          }}
          className="px-3 py-2 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-black text-xs shadow-sm flex items-center gap-1 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>سند جديد</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs, Search & Date Filters */}
      <div className="flex flex-col gap-2.5 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs (Horizontal scroll on mobile) */}
          {isOwner ? (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar scroll-smooth">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                جميع السندات
              </button>
              <button
                onClick={() => setActiveTab('RECEIPT')}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                  activeTab === 'RECEIPT' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                سندات قبض
              </button>
              <button
                onClick={() => setActiveTab('PAYMENT')}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                  activeTab === 'PAYMENT' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                سندات صرف
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <span>سندات قبض وتحصيل من العملاء فقط</span>
            </div>
          )}

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو البيان أو رقم السند..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {isOwner && (
            <div className="sm:w-52">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
              >
                <option value="">جميع المحصلين (الكل)</option>
                {employeesData?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role === 'MANDOB' ? 'مندوب' : emp.role === 'CASHIER' ? 'كاشير' : emp.role === 'MANAGER' ? 'مدير' : 'مشرف'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Range Filter Bar */}
        <div className="pt-2 border-t border-slate-100 w-full min-w-0 max-w-full overflow-hidden">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            defaultPreset="all"
            onChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white flex-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400 font-medium flex-1">جاري التحميل...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16 flex-1 flex flex-col justify-center items-center">
            <h3 className="text-base font-bold text-slate-700">لا توجد سندات مسجلة</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              انقر فوق زر "إضافة سند جديد" لتسجيل سند قبض أو صرف وتحديث الحسابات.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">رقم السند</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">النوع</th>
                    <th className="py-3.5 px-4">الطرف</th>
                    {isOwner && <th className="py-3.5 px-4">المحصّل / المنشئ</th>}
                    <th className="py-3.5 px-4">المبلغ</th>
                    <th className="py-3.5 px-4">طريقة الدفع</th>
                    <th className="py-3.5 px-4">البيان / ملاحظات</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((p: any) => {
                    const isReceipt = p.type === 'RECEIPT';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">#{p.id}</td>
                        <td className="py-3.5 px-4 text-slate-600">{p.date}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isReceipt ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isReceipt ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {isReceipt ? 'سند قبض' : 'سند صرف'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{p.party_name || 'بدون طرف'}</td>
                        {isOwner && (
                          <td className="py-3.5 px-4 text-xs">
                            {p.created_by_name ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{p.created_by_name}</span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {p.created_by_role === 'MANDOB' ? 'مندوب مبيعات' :
                                   p.created_by_role === 'CASHIER' ? 'كاشير' :
                                   p.created_by_role === 'MANAGER' ? 'مدير الفرع' :
                                   p.created_by_role === 'SUPERVISOR' ? 'مشرف' : 'المالك'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        )}
                        <td className={`py-3.5 px-4 font-black ${isReceipt ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {p.method === 'CASH' ? 'كاش' :
                           p.method === 'CARD' ? 'بطاقة / فيزا' :
                           p.method === 'INSTAPAY' ? 'إنستاباي' :
                           p.method === 'VODAFONE_CASH' ? 'فودافون كاش' :
                           p.method === 'TRANSFER' ? 'تحويل بنكي' : p.method}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{p.notes || '-'}</td>
                        <td className="py-3.5 px-4 text-center">
                          {canDeletePayment && (
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="إلغاء السند"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Touch-Optimized) */}
            <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3">
              {filteredPayments.map((p: any) => {
                const isReceipt = p.type === 'RECEIPT';
                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border p-4 shadow-sm active:scale-[0.99] transition-transform space-y-3 border-r-4 ${
                      isReceipt ? 'border-r-emerald-500 border-slate-200/80' : 'border-r-rose-500 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isReceipt ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isReceipt ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          {isReceipt ? 'سند قبض' : 'سند صرف'}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-400">#{p.id}</span>
                      </div>
                      <span className="text-xs text-slate-400">{p.date}</span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{p.party_name || 'بدون طرف'}</h4>
                        {isOwner && p.created_by_name && (
                          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                            المحصّل: {p.created_by_name} ({p.created_by_role === 'MANDOB' ? 'مندوب' : p.created_by_role === 'CASHIER' ? 'كاشير' : 'إدارة'})
                          </p>
                        )}
                      </div>
                      <div className="text-left">
                        <span className={`text-base font-black ${isReceipt ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">
                        {p.method === 'CASH' ? 'كاش (نقدية)' :
                         p.method === 'CARD' ? 'بطاقة / فيزا' :
                         p.method === 'INSTAPAY' ? 'إنستاباي' :
                         p.method === 'VODAFONE_CASH' ? 'فودافون كاش' :
                         p.method === 'TRANSFER' ? 'تحويل بنكي' : p.method}
                      </span>

                      {canDeletePayment && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="min-h-[36px] px-3 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl flex items-center gap-1 active:bg-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          إلغاء السند
                        </button>
                      )}
                    </div>

                    {p.notes && (
                      <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2.5 leading-relaxed">
                        {p.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add Voucher Modal - Responsive Bottom Sheet on Mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">تسجيل سند جديد</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع السند</label>
                {isOwner ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setValue('type', 'RECEIPT');
                        setValue('party_id', undefined as any);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        selectedType === 'RECEIPT'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
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
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        selectedType === 'PAYMENT'
                          ? 'bg-rose-50 border-rose-500 text-rose-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      صرف لمورد 🔴
                    </button>
                  </div>
                ) : (
                  <div className="py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span>سند قبض وتحصيل من عميل 🟢</span>
                  </div>
                )}
              </div>

              {/* Party Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedType === 'RECEIPT' ? 'العميل المستلم منه *' : 'المورد المدفوع له *'}
                </label>
                <select
                  {...register('party_id', { valueAsNumber: true })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">-- اختر الطرف --</option>
                  {availableParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.balance > 0 ? (selectedType === 'RECEIPT' ? `مديونية: ${formatCurrency(p.balance)}` : `مستحق: ${formatCurrency(p.balance)}`) : 'رصيد خالص'})
                    </option>
                  ))}
                </select>
                {errors.party_id && <p className="text-xs text-rose-500 mt-1">{errors.party_id.message}</p>}
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    {...register('amount', { valueAsNumber: true })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {errors.amount && <p className="text-xs text-rose-500 mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع</label>
                  <select
                    {...register('method')}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value={PaymentMethod.CASH}>نقدًا (كاش)</option>
                    <option value={PaymentMethod.CARD}>بطاقة / فيزا</option>
                    <option value={PaymentMethod.INSTAPAY}>إنستاباي (InstaPay)</option>
                    <option value={PaymentMethod.VODAFONE_CASH}>فودافون كاش ومحافظ إلكترونية</option>
                    <option value={PaymentMethod.TRANSFER}>تحويل بنكي</option>
                  </select>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ *</label>
                <input
                  type="date"
                  {...register('date')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان / ملاحظات (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="مثال: دفعة تحت الحساب عن فاتورة رقم..."
                  {...register('notes')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ السند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
