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
  MessageSquare,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { CustomerTier, Party, PartySchema, PartyInput, PartyType, formatCurrency } from '@pos-mandob/shared';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePermissions } from '../../hooks/usePermissions';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';
import { PartyMobileCard } from '../components/mobile/PartyMobileCard';
import { PaginationBar } from '../components/common/PaginationBar';
import { CustomerRiskBadge } from '../components/crm/CustomerRiskBadge';
import { PartyCrmModal } from '../components/crm/PartyCrmModal';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { nativeBackButton } from '../../platform/nativeBackButton';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Textarea,
} from '../components/ui';

export const PartiesPage: React.FC = () => {
  const { confirm } = useConfirm();
  const toast = useToast();
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
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'WITH_BALANCE' | 'ZERO_BALANCE'>('ALL');
  const [crmTierFilter, setCrmTierFilter] = useState<'ALL' | CustomerTier>('ALL');
  const [page, setPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [crmParty, setCrmParty] = useState<Party | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setBalanceFilter('ALL');
    setCrmTierFilter('ALL');
  }, [type]);

  // Fetch Parties
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['parties', type, debouncedSearch, balanceFilter, crmTierFilter, page],
    queryFn: async () => {
      const res = await apiClient.get('/parties', {
        params: {
          type,
          search: debouncedSearch || undefined,
          balance_status: balanceFilter === 'ALL' ? undefined : balanceFilter,
          crm_tier: !isSupplier && crmTierFilter !== 'ALL' ? crmTierFilter : undefined,
          page,
        },
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const parties: Party[] = data?.data || [];
  const meta = data?.meta;
  const summary = data?.summary;

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

  const handleDelete = async (p: Party) => {
    const ok = await confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف "${p.name}"؟`,
      type: 'danger',
    });
    if (ok) {
      deleteMutation.mutate(p.id);
    }
  };

  // Hardware Back Button integration
  useEffect(() => {
    if (isModalOpen) {
      return nativeBackButton.register(() => {
        setIsModalOpen(false);
        return true;
      });
    }
  }, [isModalOpen]);

  const totalParties = summary?.total_count ?? meta?.total ?? parties.length;
  const totalBalance = summary?.total_balance ?? parties.reduce((acc, p) => acc + (Number(p.balance) || 0), 0);
  const partiesWithBalance = summary?.with_balance_count ?? parties.filter((p) => Number(p.balance) !== 0).length;
  const zeroBalanceCount = summary?.zero_balance_count ?? parties.filter((p) => Number(p.balance) === 0).length;

  const balanceFilterOptions: FilterChipOption<string>[] = useMemo(
    () => [
      { id: 'ALL', label: 'الكل', count: totalParties },
      {
        id: 'WITH_BALANCE',
        label: isSupplier ? 'لهم مستحقات' : 'عليهم مديونية',
        count: partiesWithBalance,
      },
      { id: 'ZERO_BALANCE', label: 'بدون رصيد (خالص)', count: zeroBalanceCount },
    ],
    [totalParties, partiesWithBalance, zeroBalanceCount, isSupplier]
  );

  const displayedParties = parties;

  return (
    <div className="space-y-3 sm:space-y-6" dir="rtl">
      {/* Desktop Header */}
      <PageHeader
        title={pageTitle}
        description={pageSub}
        className="hidden md:flex mb-0"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={async () => {
                try {
                  const res = await apiClient.get('/parties', {
                    params: {
                      type,
                      search: debouncedSearch || undefined,
                      balance_status: balanceFilter === 'ALL' ? undefined : balanceFilter,
                      crm_tier: !isSupplier && crmTierFilter !== 'ALL' ? crmTierFilter : undefined,
                      per_page: 500,
                    },
                  });
                  const exportRows: Party[] = res.data?.data || parties;
                  const { exportPartiesToExcel } = await import('../utils/excelExport');
                  exportPartiesToExcel(exportRows, pageTitle);
                } catch (err) {
                  console.error('Excel load failed:', err);
                  toast.error('تعذر تحميل أداة Excel، تأكد من الاتصال وحاول مرة أخرى');
                }
              }}
              disabled={parties.length === 0}
              leftIcon={<Download className="w-4 h-4 text-ok" />}
              title={`تصدير قائمة ${pageTitle} إلى Excel`}
              className="text-xs font-bold"
            >
              تصدير Excel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
              className="font-bold"
            >
              {isSupplier ? 'إضافة مورد جديد' : 'إضافة عميل جديد'}
            </Button>
          </>
        }
      />

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center font-black shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-ink truncate">{pageTitle}</h2>
              <Badge tone="neutral" className="tabular-nums text-[11px] shrink-0">
                {totalParties}
              </Badge>
            </div>
            <p className="text-[11px] text-muted font-medium truncate">
              {isSupplier ? 'المستحق: ' : 'المديونيات: '}
              <span
                className={`font-black tabular-nums ${
                  totalBalance > 0
                    ? isSupplier
                      ? 'text-bad'
                      : 'text-ok'
                    : 'text-ink'
                }`}
              >
                {formatCurrency(totalBalance)}
              </span>
              {partiesWithBalance > 0 && (
                <span className="text-muted mr-1 font-normal tabular-nums">
                  ({partiesWithBalance} {isSupplier ? 'مورد' : 'عميل'})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="text-xs font-bold px-3"
          >
            إضافة
          </Button>
        </div>
      </Card>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 sm:p-4 bg-ok-soft border border-ok/30 text-ok text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-ok flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 sm:p-4 bg-bad-soft border border-bad/30 text-bad text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-bad flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <Card className="p-2.5 sm:p-4">
        <Input
          type="text"
          placeholder={`البحث بالاسم أو رقم هاتف ${isSupplier ? 'المورد' : 'العميل'}...`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          leftIcon={<Search className="w-4 h-4 sm:w-5 sm:h-5" />}
          className="bg-surface-2/60"
        />
      </Card>

      {/* Quick Filter Chips (Mobile & Desktop) */}
      <MobileFilterChips
        options={balanceFilterOptions}
        selectedId={balanceFilter}
        onSelect={(id) => {
          setBalanceFilter(id as any);
          setPage(1);
        }}
      />

      {!isSupplier && (
        <MobileFilterChips
          options={[
            { id: 'ALL', label: 'كل التصنيفات (CRM)' },
            { id: CustomerTier.VIP, label: 'VIP مميز' },
            { id: CustomerTier.REPEAT, label: 'عميل متكرر' },
            { id: CustomerTier.HIGH_CANCELLATION, label: 'عالي الإلغاء' },
            { id: CustomerTier.BLACKLISTED, label: 'محظور' },
          ]}
          selectedId={crmTierFilter}
          onSelect={(id) => {
            setCrmTierFilter(id as 'ALL' | CustomerTier);
            setPage(1);
          }}
        />
      )}

      {/* Table */}
      <Card className="p-0 sm:p-0 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted font-medium">جاري التحميل...</div>
        ) : displayedParties.length === 0 ? (
          <EmptyState
            icon={<Icon className="w-6 h-6" />}
            title={`لا يوجد ${pageTitle} مسجلين`}
            description={
              search
                ? 'لم نجد أي نتائج تطابق البحث'
                : `ابدأ بإضافة أول ${isSupplier ? 'مورد' : 'عميل'} لحفظ العمليات وكشف الحساب`
            }
            className="border-0 rounded-none py-16"
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <DataTable className="hidden md:block border-0 rounded-none shadow-none">
              <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
                <tr>
                  <th className="py-3.5 px-4">الاسم</th>
                  <th className="py-3.5 px-4">الهاتف</th>
                  {!isSupplier && <th className="py-3.5 px-4">تصنيف CRM</th>}
                  <th className="py-3.5 px-4">العنوان</th>
                  <th className="py-3.5 px-4">الرصيد الحالي</th>
                  <th className="py-3.5 px-4">الفواتير</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayedParties.map((p) => {
                  const isPositive = p.balance > 0;
                  const isZero = p.balance === 0;
                  const balanceTone = isZero
                    ? 'neutral'
                    : isPositive
                      ? isSupplier
                        ? 'bad'
                        : 'ok'
                      : 'info';

                  return (
                    <tr key={p.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-ink">{p.name}</td>
                      <td className="py-3.5 px-4 text-muted">
                        {p.phone ? (
                          <span className="inline-flex items-center gap-1.5 tabular-nums text-xs" dir="ltr">
                            <Phone className="w-3.5 h-3.5 text-muted" />
                            {p.phone}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      {!isSupplier && (
                        <td className="py-3.5 px-4">
                          <CustomerRiskBadge metrics={p.crm_metrics} variant="badge" />
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-muted text-xs truncate max-w-[200px]">
                        {p.address ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-muted" />
                            {p.address}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.balance === 0 ? (
                          <span className="text-xs font-bold text-muted tabular-nums">
                            {formatCurrency(p.balance)}
                          </span>
                        ) : (
                          <Badge tone={balanceTone} className="font-black tabular-nums">
                            {formatCurrency(p.balance)}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5 text-muted" />
                          {p.invoices_count || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {!isSupplier && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              onClick={() => setCrmParty(p)}
                              className="text-muted hover:text-brand px-2.5"
                              title="ملف العميل وتفاعلات CRM"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => navigate(`/ledger/${p.id}`)}
                            className="text-muted hover:text-ok px-2.5"
                            title="كشف حساب تفصيلي"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => openEditModal(p)}
                            className="text-muted hover:text-brand px-2.5"
                            title="تعديل البيانات"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {canDeleteParty && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              onClick={() => handleDelete(p)}
                              className="text-muted hover:text-bad px-2.5"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>

            {/* Mobile Contact Cards View (md:hidden) */}
            <div className="md:hidden space-y-3 p-3 bg-surface-2/50">
              {displayedParties.map((p) => (
                <PartyMobileCard
                  key={p.id}
                  party={p}
                  isSupplier={isSupplier}
                  canDelete={canDeleteParty}
                  onLedger={(party) => navigate(`/ledger/${party.id}`)}
                  onOpenCrm={!isSupplier ? (party) => setCrmParty(party) : undefined}
                  onEdit={(party) => openEditModal(party)}
                  onDelete={(party) => handleDelete(party)}
                />
              ))}
            </div>

            <PaginationBar
              currentPage={meta?.current_page || page}
              lastPage={meta?.last_page || 1}
              total={meta?.total || displayedParties.length}
              perPage={meta?.per_page || 50}
              isFetching={isFetching}
              onPageChange={(newPage) => setPage(newPage)}
              itemLabel={isSupplier ? 'مورد' : 'عميل'}
            />
          </>
        )}
      </Card>

      {/* Modal - Responsive Bottom Sheet */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-panel text-ink rounded-t-[2.5rem] sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-line space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-lg text-ink">
                {editingParty
                  ? `تعديل بيانات ${isSupplier ? 'المورد' : 'العميل'}`
                  : `إضافة ${isSupplier ? 'مورد' : 'عميل'} جديد`}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-ink px-2"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="الاسم *"
                {...register('name')}
                type="text"
                placeholder={isSupplier ? 'مثال: شركة النصر للتوزيع' : 'مثال: سوبر ماركت الأمانة'}
                error={errors.name?.message}
                className="bg-surface-2/60"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="رقم الهاتف"
                  {...register('phone')}
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="bg-surface-2/60 text-right tabular-nums"
                />
                <Input
                  label="هاتف إضافي"
                  {...register('phone2')}
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="bg-surface-2/60 text-right tabular-nums"
                />
              </div>

              <Input
                label="العنوان / المنطقة"
                {...register('address')}
                type="text"
                placeholder="مثال: المنصورة - شارع الجيش"
                className="bg-surface-2/60"
              />

              {!editingParty && (
                <Input
                  label="الرصيد الافتتاحي (ج.م)"
                  {...register('initial_balance')}
                  type="number"
                  step="0.01"
                  placeholder="0"
                  helperText={
                    isSupplier
                      ? 'موجب = مديونية علينا للمورد / سالب = دفعات مقدمة له'
                      : 'موجب = مديونية على العميل لصالحنا / سالب = رصيد له'
                  }
                  className="bg-surface-2/60 tabular-nums"
                />
              )}

              <Textarea
                label="ملاحظات"
                {...register('notes')}
                rows={2}
                className="bg-surface-2/60"
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={saveMutation.isPending}
                  isLoading={saveMutation.isPending}
                  className="text-xs font-bold"
                >
                  {saveMutation.isPending
                    ? 'جاري الحفظ...'
                    : editingParty
                      ? 'حفظ التعديلات'
                      : 'إضافة وحفظ'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PartyCrmModal
        partyId={crmParty?.id ?? null}
        initialParty={crmParty}
        onClose={() => setCrmParty(null)}
      />
    </div>
  );
};
