import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Users,
  Truck,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Receipt,
  FileText,
  Download,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { Party, PartySchema, PartyInput, PartyType, formatCurrency } from '@pos-mandob/shared';
import { exportPartiesToExcel } from '../utils/excelExport';
import { usePermissions } from '../../hooks/usePermissions';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';
import { PartyMobileCard } from '../components/mobile/PartyMobileCard';
import { PaginationBar } from '../components/common/PaginationBar';
import { nativeBackButton } from '../../platform/nativeBackButton';

export const PartiesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canDeleteParty } = usePermissions();
  const isSupplier = location.pathname.includes('suppliers');
  const type: PartyType = isSupplier ? PartyType.SUPPLIER : PartyType.CUSTOMER;

  const pageTitle = isSupplier ? 'الموردين' : 'العملاء';
  const pageSub = isSupplier
    ? 'إدارة حسابات الموردين، سندات الصرف، ومتابعة الأرصدة والديون'
    : 'إدارة بيانات العملاء، سندات القبض، والمديونيات وكشوف الحسابات';
  const Icon = isSupplier ? Truck : Users;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [type]);

  // Fetch Parties
  const { data, isLoading } = useQuery({
    queryKey: ['parties', type, search, page],
    queryFn: async () => {
      const res = await apiClient.get('/parties', {
        params: {
          type,
          search: search || undefined,
          page,
        },
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const parties: Party[] = data?.data || [];
  const meta = data?.meta;

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PartyInput>({
    resolver: zodResolver(PartySchema),
    defaultValues: {
      type,
      initial_balance: 0,
    },
  });

  const openCreateModal = () => {
    setEditingParty(null);
    reset({
      type,
      name: '',
      phone: '',
      phone2: '',
      address: '',
      notes: '',
      initial_balance: 0,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Party) => {
    setEditingParty(p);
    setValue('type', p.type);
    setValue('name', p.name);
    setValue('phone', p.phone || '');
    setValue('phone2', p.phone2 || '');
    setValue('address', p.address || '');
    setValue('notes', p.notes || '');
    setValue('initial_balance', 0);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (input: PartyInput) => {
      if (editingParty) {
        return apiClient.put(`/parties/${editingParty.id}`, input);
      } else {
        return apiClient.post('/parties', input);
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsModalOpen(false);
      setSuccessMessage(res.data.message || `تم حفظ بيانات ${pageTitle} بنجاح`);
      setTimeout(() => setSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر الحفظ');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/parties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setSuccessMessage(`تم حذف ${isSupplier ? 'المورد' : 'العميل'} بنجاح`);
      setTimeout(() => setSuccessMessage(null), 3500);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر الحذف لوجود معاملات سابقة');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const onSubmit = (formData: PartyInput) => {
    saveMutation.mutate(formData);
  };

  const handleDelete = (p: Party) => {
    if (window.confirm(`هل أنت متأكد من حذف "${p.name}"؟`)) {
      deleteMutation.mutate(p.id);
    }
  };

  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'WITH_BALANCE' | 'ZERO_BALANCE'>('ALL');

  // Hardware Back Button integration
  useEffect(() => {
    if (isModalOpen) {
      return nativeBackButton.register(() => {
        setIsModalOpen(false);
        return true;
      });
    }
  }, [isModalOpen]);

  const totalParties = parties.length;
  const totalBalance = parties.reduce((acc, p) => acc + (Number(p.balance) || 0), 0);
  const partiesWithBalance = parties.filter((p) => Number(p.balance) !== 0).length;
  const zeroBalanceCount = parties.filter((p) => Number(p.balance) === 0).length;

  const balanceFilterOptions: FilterChipOption<string>[] = useMemo(
    () => [
      { id: 'ALL', label: 'الكل', count: parties.length },
      {
        id: 'WITH_BALANCE',
        label: isSupplier ? 'لهم مستحقات' : 'عليهم مديونية',
        count: partiesWithBalance,
      },
      { id: 'ZERO_BALANCE', label: 'بدون رصيد (خالص)', count: zeroBalanceCount },
    ],
    [parties.length, partiesWithBalance, zeroBalanceCount, isSupplier]
  );

  const displayedParties = useMemo(() => {
    if (balanceFilter === 'WITH_BALANCE') {
      return parties.filter((p) => Number(p.balance) !== 0);
    }
    if (balanceFilter === 'ZERO_BALANCE') {
      return parties.filter((p) => Number(p.balance) === 0);
    }
    return parties;
  }, [parties, balanceFilter]);

  return (
    <div className="space-y-3 sm:space-y-6" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{pageTitle}</h2>
          <p className="text-sm text-slate-500">{pageSub}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportPartiesToExcel(parties, pageTitle)}
            disabled={parties.length === 0}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            title={`تصدير قائمة ${pageTitle} إلى Excel`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            تصدير Excel
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isSupplier ? 'إضافة مورد جديد' : 'إضافة عميل جديد'}
          </button>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-black shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">{pageTitle}</h2>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                {totalParties}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {isSupplier ? 'المستحق: ' : 'المديونيات: '}
              <span
                className={`font-black font-mono ${
                  totalBalance > 0
                    ? isSupplier
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                    : 'text-slate-700'
                }`}
              >
                {formatCurrency(totalBalance)}
              </span>
              {partiesWithBalance > 0 && (
                <span className="text-slate-400 mr-1 font-normal">
                  ({partiesWithBalance} {isSupplier ? 'مورد' : 'عميل'})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1 bg-primary-600 active:bg-primary-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 sm:p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 sm:p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`البحث بالاسم أو رقم هاتف ${isSupplier ? 'المورد' : 'العميل'}...`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-4 pr-9 sm:pr-10 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-right"
          />
        </div>
      </div>

      {/* Quick Filter Chips (Mobile & Desktop) */}
      <MobileFilterChips
        options={balanceFilterOptions}
        selectedId={balanceFilter}
        onSelect={(id) => setBalanceFilter(id as any)}
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400 font-medium">جاري التحميل...</div>
        ) : displayedParties.length === 0 ? (
          <div className="text-center py-16">
            <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">لا يوجد {pageTitle} مسجلين</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {search ? 'لم نجد أي نتائج تطابق البحث' : `ابدأ بإضافة أول ${isSupplier ? 'مورد' : 'عميل'} لحفظ العمليات وكشف الحساب`}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">الاسم</th>
                    <th className="py-3.5 px-4">الهاتف</th>
                    <th className="py-3.5 px-4">العنوان</th>
                    <th className="py-3.5 px-4">الرصيد الحالي</th>
                    <th className="py-3.5 px-4">الفواتير</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedParties.map((p) => {
                    const isPositive = p.balance > 0;
                    const isZero = p.balance === 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {p.phone ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs" dir="ltr">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {p.phone}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs truncate max-w-[200px]">
                          {p.address ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {p.address}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`font-black text-xs px-2.5 py-1 rounded-full ${
                              isZero
                                ? 'bg-slate-100 text-slate-700'
                                : isPositive
                                ? isSupplier
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {formatCurrency(p.balance)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-slate-400" />
                            {p.invoices_count || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => navigate(`/ledger/${p.id}`)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="كشف حساب تفصيلي"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="تعديل البيانات"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {canDeleteParty && (
                              <button
                                onClick={() => handleDelete(p)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                                title="حذف"
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
              </table>
            </div>

            {/* Mobile Contact Cards View (md:hidden) */}
            <div className="md:hidden space-y-3 p-3 bg-slate-50/60">
              {displayedParties.map((p) => (
                <PartyMobileCard
                  key={p.id}
                  party={p}
                  isSupplier={isSupplier}
                  canDelete={canDeleteParty}
                  onLedger={(party) => navigate(`/ledger/${party.id}`)}
                  onEdit={(party) => openEditModal(party)}
                  onDelete={(party) => handleDelete(party)}
                />
              ))}
            </div>

            <PaginationBar
              currentPage={meta?.current_page || page}
              lastPage={meta?.last_page || 1}
              total={meta?.total || displayedParties.length}
              perPage={meta?.per_page || 20}
              onPageChange={(newPage) => setPage(newPage)}
              itemLabel={isSupplier ? 'مورد' : 'عميل'}
            />
          </>
        )}
      </div>

      {/* Modal - Responsive Bottom Sheet */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">
                {editingParty ? `تعديل بيانات ${isSupplier ? 'المورد' : 'العميل'}` : `إضافة ${isSupplier ? 'مورد' : 'عميل'} جديد`}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم *</label>
                <input
                  {...register('name')}
                  type="text"
                  placeholder={isSupplier ? 'مثال: شركة النصر للتوزيع' : 'مثال: سوبر ماركت الأمانة'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">هاتف إضافي</label>
                  <input
                    {...register('phone2')}
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان / المنطقة</label>
                <input
                  {...register('address')}
                  type="text"
                  placeholder="مثال: المنصورة - شارع الجيش"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                />
              </div>

              {!editingParty && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الافتتاحي (ج.م)</label>
                  <input
                    {...register('initial_balance')}
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isSupplier
                      ? 'موجب = مديونية علينا للمورد / سالب = دفعات مقدمة له'
                      : 'موجب = مديونية على العميل لصالحنا / سالب = رصيد له'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition-colors"
                >
                  {saveMutation.isPending ? 'جاري الحفظ...' : editingParty ? 'حفظ التعديلات' : 'إضافة وحفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
