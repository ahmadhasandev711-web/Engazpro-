import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Package,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatCurrency, PartyType } from '@pos-mandob/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../data/store/useAuthStore';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';

import { Badge, Button, DataTable, EmptyState, Input, PageHeader, StatCard } from '../components/ui';
import { CourierMobileCard } from '../components/mobile/CourierMobileCard';
import {
  CourierManifestModal,
  type ManifestPaymentFilter,
  type ManifestSourceFilter,
} from '../components/couriers/CourierManifestModal';
import { CourierSettleModal, type SettleMethod } from '../components/couriers/CourierSettleModal';
import { CourierFormModal } from '../components/couriers/CourierFormModal';
import { nativeBackButton } from '../../platform/nativeBackButton';

export const CouriersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canDeleteParty, canSettleCouriers, canManageCouriers } = usePermissions();
  const { confirm } = useConfirm();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add/Edit Courier Modal State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<any | null>(null);
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [courierPhone2, setCourierPhone2] = useState('');
  const [courierAddress, setCourierAddress] = useState('');
  const [courierNotes, setCourierNotes] = useState('');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [partyFormError, setPartyFormError] = useState<string | null>(null);

  // Manifest Modal State
  const [manifestCourier, setManifestCourier] = useState<any | null>(null);
  const [manifestStatusFilter, setManifestStatusFilter] = useState<string>('ALL');
  const [manifestPaymentFilter, setManifestPaymentFilter] = useState<ManifestPaymentFilter>('ALL');
  const [manifestSourceFilter, setManifestSourceFilter] = useState<ManifestSourceFilter>('ALL');
  const [manifestSearch, setManifestSearch] = useState<string>('');
  const [manifestPage, setManifestPage] = useState<number>(1);

  const user = useAuthStore((s) => s.user);
  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر Easyfy';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;

  // Quick Settlement Modal State
  const [settleCourier, setSettleCourier] = useState<any | null>(null);
  const [settleType, setSettleType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<SettleMethod>('CASH');
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [settleError, setSettleError] = useState<string | null>(null);

  // Hardware Back Button integration
  useEffect(() => {
    if (manifestCourier) {
      return nativeBackButton.register(() => {
        setManifestCourier(null);
        return true;
      });
    }
  }, [manifestCourier]);

  useEffect(() => {
    if (settleCourier) {
      return nativeBackButton.register(() => {
        setSettleCourier(null);
        return true;
      });
    }
  }, [settleCourier]);

  useEffect(() => {
    if (isPartyModalOpen) {
      return nativeBackButton.register(() => {
        setIsPartyModalOpen(false);
        return true;
      });
    }
  }, [isPartyModalOpen]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // 1. Fetch Couriers List & Summary
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const { data: couriersData, isLoading } = useQuery({
    queryKey: ['couriers', debouncedSearch],
    queryFn: async () => {
      const res = await apiClient.get('/couriers', {
        params: { search: debouncedSearch || undefined },
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const couriers: any[] = couriersData?.data || [];
  const summary = couriersData?.summary || {
    total_couriers: 0,
    global_active_shipments: 0,
    global_pending_cod: 0,
    global_net_balance: 0,
  };

  // 2. Fetch Manifest for Selected Courier
  const { data: manifestData, isLoading: isManifestLoading, isFetching: isManifestFetching } = useQuery({
    queryKey: ['courier-manifest', manifestCourier?.id, manifestStatusFilter, manifestPaymentFilter, manifestSourceFilter, manifestSearch, manifestPage],
    queryFn: async () => {
      if (!manifestCourier?.id) return null;
      const res = await apiClient.get(`/couriers/${manifestCourier.id}/manifest`, {
        params: {
          status: manifestStatusFilter !== 'ALL' ? manifestStatusFilter : undefined,
          payment_status: manifestPaymentFilter !== 'ALL' ? manifestPaymentFilter : undefined,
          source: manifestSourceFilter !== 'ALL' ? manifestSourceFilter : undefined,
          search: manifestSearch.trim() || undefined,
          page: manifestPage,
        },
      });
      return res.data;
    },
    enabled: !!manifestCourier?.id,
    placeholderData: (prev) => prev,
  });

  const shipments: any[] = manifestData?.shipments || [];
  const filteredShipments = shipments;

  const manifestMetrics = manifestData?.metrics || {
    total_shipments: 0,
    in_transit_count: 0,
    delivered_count: 0,
    returned_count: 0,
    total_cod_amount: 0,
    total_shipping_fees: 0,
    collected_cod_amount: 0,
    pending_cod_amount: 0,
  };
  const manifestPagination = manifestData?.pagination || manifestData?.meta;

  // 3. Create / Update Courier Mutation
  const saveCourierMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type: PartyType.COURIER,
        name: courierName.trim(),
        phone: courierPhone.trim() || undefined,
        phone2: courierPhone2.trim() || undefined,
        address: courierAddress.trim() || undefined,
        notes: courierNotes.trim() || undefined,
        initial_balance: editingCourier ? undefined : initialBalance,
      };

      if (editingCourier) {
        return apiClient.put(`/parties/${editingCourier.id}`, payload);
      }
      return apiClient.post('/parties', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couriers'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setIsPartyModalOpen(false);
      showNotification('success', editingCourier ? 'تم تعديل بيانات شركة الشحن بنجاح' : 'تمت إضافة شركة الشحن بنجاح');
    },
    onError: (err: any) => {
      setPartyFormError(err.response?.data?.message || 'تعذر حفظ بيانات شركة الشحن');
    },
  });

  // 4. Delete Courier Mutation
  const deleteCourierMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/parties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couriers'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      showNotification('success', 'تم حذف شركة الشحن بنجاح');
    },
    onError: (err: any) => {
      showNotification('error', err.response?.data?.message || 'تعذر حذف شركة الشحن لوجود معاملات سابقة');
    },
  });

  // 5. Quick Settlement Mutation (Net Settlement with Treasury/Bank)
  const settlementMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post(`/couriers/${settleCourier.id}/settle`, {
        type: settleType,
        amount: Number(settleAmount),
        method: settleMethod,
        notes: settleNotes.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['couriers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSettleCourier(null);
      showNotification('success', res.data?.message || 'تمت تصفية مستحقات شركة الشحن وتوريد المبلغ بنجاح');
    },
    onError: (err: any) => {
      setSettleError(err.response?.data?.message || 'تعذر تسجيل التصفية');
    },
  });

  const openCreateModal = () => {
    setEditingCourier(null);
    setCourierName('');
    setCourierPhone('');
    setCourierPhone2('');
    setCourierAddress('');
    setCourierNotes('');
    setInitialBalance(0);
    setPartyFormError(null);
    setIsPartyModalOpen(true);
  };

  const openEditModal = (c: any) => {
    setEditingCourier(c);
    setCourierName(c.name || '');
    setCourierPhone(c.phone || '');
    setCourierPhone2(c.phone2 || '');
    setCourierAddress(c.address || '');
    setCourierNotes(c.notes || '');
    setPartyFormError(null);
    setIsPartyModalOpen(true);
  };

  const openSettleModal = (c: any, defaultType?: 'RECEIPT' | 'PAYMENT') => {
    setSettleCourier(c);
    const balanceNum = Number(c.balance) || 0;
    const computedType = defaultType || (balanceNum < 0 ? 'PAYMENT' : 'RECEIPT');
    setSettleType(computedType);
    setSettleAmount(balanceNum !== 0 ? Math.abs(balanceNum) : (c.pending_cod_amount || 0));
    setSettleMethod('CASH');
    setSettleNotes('');
    setSettleError(null);
  };

  const handleExportManifest = async () => {
    try {
      const { exportManifestToExcel } = await import('../utils/excelExport');
      exportManifestToExcel(filteredShipments, manifestCourier?.name || 'شركة_الشحن');
    } catch (err) {
      console.error('Excel load failed:', err);
      toast.error('تعذر تحميل أداة Excel، تأكد من الاتصال وحاول مرة أخرى');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* Feedback Toast Notification */}
      {feedback && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 ${
            feedback.type === 'success'
              ? 'bg-ok-soft text-ok border-ok/30'
              : 'bg-bad-soft text-bad border-bad/30'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-ok" />
          ) : (
            <AlertCircle className="w-4 h-4 text-bad" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="شركات الشحن والتوصيل"
        description="إدارة حسابات شركات الشحن، متابعة تسليم الطرود، ومطابقة وتصفية مبالغ الدفع عند الاستلام (COD) مع الخزينة."
        badge={
          <Badge tone="brand" className="hidden sm:inline-flex">
            {summary.total_couriers} شركة
          </Badge>
        }
        actions={
          canSettleCouriers ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              إضافة شركة شحن جديدة
            </Button>
          ) : undefined
        }
        className="mb-0"
      />

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="شركات الشحن"
          value={summary.total_couriers}
          hint="شركة مسجلة بالدفاتر"
          tone="brand"
          icon={<Truck className="w-4 h-4" />}
        />
        <StatCard
          label="طرود قيد التوصيل"
          value={summary.global_active_shipments}
          hint="في عهدة شركات الشحن حالياً"
          tone="warn"
          icon={<Package className="w-4 h-4" />}
        />
        <StatCard
          label="مبالغ قيد التحصيل (COD)"
          value={formatCurrency(summary.global_pending_cod)}
          hint="مستحقات معلقة جاري تحصيلها"
          tone="info"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          label="صافي الأرصدة الدفترية"
          value={formatCurrency(summary.global_net_balance)}
          hint="رصيد شركات الشحن المالي"
          tone="ok"
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      {/* Main Couriers Table */}
      <div className="bg-panel rounded-2xl border border-line shadow-xs overflow-hidden transition-colors">
        {/* Search Bar */}
        <div className="p-4 border-b border-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:max-w-xs">
            <Input
              type="text"
              placeholder="بحث باسم شركة الشحن أو الهاتف..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="text-xs text-muted font-bold">
            إجمالي الشركات: <span className="text-brand font-black tabular-nums">{couriers.length}</span>
          </div>
        </div>

        {/* Table View */}
        {isLoading ? (
          <div className="p-12 text-center text-xs font-bold text-muted flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-brand" />
            <span>جاري تحميل بيانات شركات الشحن...</span>
          </div>
        ) : couriers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Truck className="w-6 h-6 text-brand" />}
              title="لا توجد شركات شحن مسجلة حتى الآن"
              description='اضغط على "إضافة شركة شحن جديدة" لتسجيل شركات الشحن المحلية أو الخارجية وبدء متابعة الشحنات وتسوية الكاش.'
              action={
                canSettleCouriers ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={openCreateModal}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    إضافة شركة شحن جديدة
                  </Button>
                ) : undefined
              }
              className="border-0 py-10"
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable className="border-0 rounded-none shadow-none">
                <thead>
                  <tr className="bg-surface-2/80 border-b border-line text-xs font-black text-muted">
                    <th className="py-3 px-4">شركة الشحن</th>
                    <th className="py-3 px-4">بيانات التواصل والعنوان</th>
                    <th className="py-3 px-4 text-center">الطرود في العهدة</th>
                    <th className="py-3 px-4 text-center">مبالغ قيد التحصيل (COD)</th>
                    <th className="py-3 px-4 text-center">الرصيد المالي بالدفاتر</th>
                    <th className="py-3 px-4 text-left">إجراءات المتابعة والتسوية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs font-medium text-ink">
                  {couriers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-xs">{c.name}</span>
                          <Badge tone="brand" className="text-2xs px-1.5 py-0">
                            شركة شحن
                          </Badge>
                        </div>
                        {c.notes && <p className="text-xs text-muted mt-0.5 max-w-xs truncate">{c.notes}</p>}
                      </td>

                      <td className="py-3 px-4">
                        {c.phone ? (
                          <div className="flex items-center gap-1 text-ink tabular-nums text-xs">
                            <Phone className="w-3 h-3 text-muted" />
                            <span>{c.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted text-xs">بدون هاتف</span>
                        )}
                        {c.address && (
                          <div className="flex items-center gap-1 text-muted text-2xs mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{c.address}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {c.active_shipments_count > 0 ? (
                          <button
                            type="button"
                            onClick={() => setManifestCourier(c)}
                            className="min-h-[36px] px-2.5 py-1 bg-warn-soft text-warn border border-warn/30 rounded-lg text-xs font-bold hover:opacity-90 transition cursor-pointer inline-flex items-center gap-1 tabular-nums"
                          >
                            <Package className="w-3 h-3 text-warn" />
                            <span>{c.active_shipments_count} طرد قيد التوصيل</span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted font-medium">لا توجد شحنات معلقة</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-bold tabular-nums text-info text-xs">
                          {formatCurrency(c.pending_cod_amount || 0)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center tabular-nums">
                        {Number(c.balance) !== 0 ? (
                          <Badge
                            tone={Number(c.balance) > 0 ? 'ok' : 'bad'}
                            className="font-black text-xs px-2 py-0.5 rounded-lg"
                          >
                            {formatCurrency(c.balance)}
                          </Badge>
                        ) : (
                          <span className="text-muted text-xs">0.00 (خالص)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setManifestCourier(c)}
                            leftIcon={<Package className="w-3.5 h-3.5" />}
                            title="كشف البوالص والشحنات التفصيلي (Manifest)"
                          >
                            <span className="hidden sm:inline">كشف الشحنات</span>
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/ledger/${c.id}`)}
                            leftIcon={<FileText className="w-3.5 h-3.5" />}
                            title="كشف الحساب المالي التفصيلي"
                          >
                            <span className="hidden sm:inline">كشف الحساب</span>
                          </Button>

                          {canSettleCouriers && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openSettleModal(c)}
                              leftIcon={<Wallet className="w-3.5 h-3.5 text-ok" />}
                              className="bg-ok-soft text-ok border-ok/30 hover:bg-ok-soft/80 font-black"
                              title="تصفية واستلام صافي المستحقات"
                            >
                              <span>تصفية واستلام</span>
                            </Button>
                          )}

                          {canManageCouriers && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(c)}
                              title="تعديل"
                              aria-label="تعديل"
                              className="px-2"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {canDeleteParty && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'تأكيد حذف شركة الشحن',
                                  message: `هل أنت متأكد من حذف شركة الشحن "${c.name}"؟`,
                                  type: 'danger',
                                });
                                if (ok) {
                                  deleteCourierMutation.mutate(c.id);
                                }
                              }}
                              title="حذف"
                              aria-label="حذف"
                              className="px-2 text-bad hover:bg-bad-soft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            {/* Mobile Cards View (md:hidden) */}
            <div className="md:hidden space-y-3 p-3 bg-canvas/60">
              {couriers.map((c: any) => (
                <CourierMobileCard
                  key={c.id}
                  courier={c}
                  canDeleteParty={canDeleteParty}
                  canSettle={canSettleCouriers}
                  canEdit={canManageCouriers}
                  onOpenManifest={(cour) => setManifestCourier(cour)}
                  onOpenSettle={(cour) => openSettleModal(cour)}
                  onOpenLedger={(id) => navigate(`/ledger/${id}`)}
                  onEditCourier={(cour) => openEditModal(cour)}
                  onDeleteCourier={async (id, name) => {
                    const ok = await confirm({
                      title: 'تأكيد حذف شركة الشحن',
                      message: `هل أنت متأكد من حذف شركة الشحن "${name}"؟`,
                      type: 'danger',
                    });
                    if (ok) {
                      deleteCourierMutation.mutate(id);
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal 1: Manifest Modal + Untouched Corporate A4 Printable Sheet */}
      {manifestCourier && (
        <>
          <CourierManifestModal
            courier={manifestCourier}
            shipments={filteredShipments}
            metrics={manifestMetrics}
            pagination={manifestPagination}
            isLoading={isManifestLoading}
            isFetching={isManifestFetching}
            statusFilter={manifestStatusFilter}
            onStatusFilterChange={(value) => {
              setManifestStatusFilter(value);
              setManifestPage(1);
            }}
            paymentFilter={manifestPaymentFilter}
            onPaymentFilterChange={(value) => {
              setManifestPaymentFilter(value);
              setManifestPage(1);
            }}
            sourceFilter={manifestSourceFilter}
            onSourceFilterChange={(value) => {
              setManifestSourceFilter(value);
              setManifestPage(1);
            }}
            search={manifestSearch}
            onSearchChange={(value) => {
              setManifestSearch(value);
              setManifestPage(1);
            }}
            page={manifestPage}
            onPageChange={setManifestPage}
            onExportExcel={handleExportManifest}
            onPrint={() => window.print()}
            onClose={() => setManifestCourier(null)}
          />

          {/* ========================================================================= */}
          {/* Dedicated Corporate Printable Manifest Sheet (A4 Print-Only)              */}
          {/* ========================================================================= */}
          <div className="print-only printable-area font-sans bg-paper text-paper-ink leading-relaxed text-xs" dir="rtl">
            {/* Store Letterhead */}
            <div className="border-b-2 border-paper-ink pb-3 mb-4 flex items-start justify-between">
              <div className="space-y-1">
                <h1 className="text-xl font-black text-paper-ink">{storeName}</h1>
                <p className="text-xs font-bold text-paper-muted">نظام إدارة نقاط البيع والمخازن والشحنات</p>
                {storePhone && <p className="text-[11px] text-paper-muted font-mono">الهاتف: {storePhone}</p>}
                {storeAddress && <p className="text-[11px] text-paper-muted">{storeAddress}</p>}
              </div>

              <div className="text-left space-y-1">
                <div className="inline-block bg-paper-ink text-paper font-black px-3 py-1 rounded text-sm">
                  مانيفست تسليم بوالص وشحنات
                </div>
                <p className="text-xs font-black text-paper-ink">
                  شركة الشحن: {manifestCourier.name}
                </p>
                {manifestCourier.phone && (
                  <p className="text-[11px] text-paper-muted font-mono" dir="ltr">
                    هاتف المندوب/الشركة: {manifestCourier.phone}
                  </p>
                )}
                <p className="text-2xs text-paper-muted font-mono">
                  تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
                </p>
              </div>
            </div>

            {/* Manifest Summary Bar in Print */}
            <div className="grid grid-cols-5 gap-2 p-2.5 bg-paper-soft border border-paper-line rounded mb-4 text-center">
              <div>
                <span className="text-2xs text-paper-muted block font-bold">إجمالي الطرود</span>
                <span className="text-sm font-black text-paper-ink">{manifestMetrics.total_shipments}</span>
              </div>
              <div>
                <span className="text-2xs text-paper-muted block font-bold">قيد التوصيل بالعهدة</span>
                <span className="text-sm font-black text-warn">{manifestMetrics.in_transit_count}</span>
              </div>
              <div>
                <span className="text-2xs text-paper-muted block font-bold">تم التسليم</span>
                <span className="text-sm font-black text-ok">{manifestMetrics.delivered_count}</span>
              </div>
              <div>
                <span className="text-2xs text-paper-muted block font-bold">مطلوب تحصيله (COD)</span>
                <span className="text-sm font-black text-brand font-mono">{formatCurrency(manifestMetrics.total_cod_amount)}</span>
              </div>
              <div>
                <span className="text-2xs text-paper-muted block font-bold">إجمالي أتعاب الشحن</span>
                <span className="text-sm font-black text-paper-ink font-mono">{formatCurrency(manifestMetrics.total_shipping_fees)}</span>
              </div>
            </div>

            {/* A4 Manifest Print Table */}
            <table className="w-full text-right border-collapse border border-paper-line text-2xs">
              <thead>
                <tr className="bg-paper-soft text-paper-ink font-black border-b border-paper-line">
                  <th className="p-1.5 border border-paper-line text-center w-8">م</th>
                  <th className="p-1.5 border border-paper-line">رقم الطلب / المصدر</th>
                  <th className="p-1.5 border border-paper-line">اسم العميل ورقم الهاتف</th>
                  <th className="p-1.5 border border-paper-line">المدينة والعنوان</th>
                  <th className="p-1.5 border border-paper-line text-center">رقم البوليصة</th>
                  <th className="p-1.5 border border-paper-line text-center">نوع التحصيل</th>
                  <th className="p-1.5 border border-paper-line text-center">مطلوب COD</th>
                  <th className="p-1.5 border border-paper-line text-center">أجرة الشحن</th>
                  <th className="p-1.5 border border-paper-line text-center">حالة التوصيل</th>
                  <th className="p-1.5 border border-paper-line text-center w-28">توقيع المستلم وملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {filteredShipments.map((s: any, idx: number) => (
                  <tr key={s.id + s.source} className="border-b border-paper-line">
                    <td className="p-1.5 border border-paper-line text-center font-bold font-mono">{idx + 1}</td>
                    <td className="p-1.5 border border-paper-line">
                      <span className="font-bold font-mono block">{s.reference}</span>
                      <span className="text-2xs text-paper-muted">{s.source === 'WOOCOMMERCE' ? 'ووكومرس' : 'مباشر'}</span>
                    </td>
                    <td className="p-1.5 border border-paper-line">
                      <span className="font-bold block">{s.customer_name}</span>
                      <span className="font-mono text-2xs text-paper-muted" dir="ltr">{s.customer_phone || '—'}</span>
                    </td>
                    <td className="p-1.5 border border-paper-line">
                      {[s.city, s.customer_address].filter(Boolean).join(' - ') || '—'}
                    </td>
                    <td className="p-1.5 border border-paper-line text-center font-mono font-bold">
                      {s.tracking_number || '—'}
                    </td>
                    <td className="p-1.5 border border-paper-line text-center font-bold">
                      {s.is_paid_online ? 'أونلاين (مدفوع)' : 'عند الاستلام (COD)'}
                    </td>
                    <td className="p-1.5 border border-paper-line text-center font-mono font-black text-paper-ink">
                      {s.is_paid_online ? '0.00 ج.م' : formatCurrency(s.cod_amount ?? s.total)}
                    </td>
                    <td className="p-1.5 border border-paper-line text-center font-mono">
                      {formatCurrency(s.shipping_cost || 0)}
                    </td>
                    <td className="p-1.5 border border-paper-line text-center font-bold">
                      {s.status_label || s.status}
                    </td>
                    <td className="p-1.5 border border-paper-line text-center text-2xs text-paper-muted">
                      {/* توقيع أو ملاحظة استلام */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures Footer */}
            <div className="mt-8 pt-4 border-t-2 border-paper-line grid grid-cols-3 gap-4 text-center">
              <div className="space-y-6">
                <p className="font-bold text-xs">مسؤول تسليم الشحنات (المحل)</p>
                <div className="border-b border-dotted border-paper-line w-36 mx-auto"></div>
              </div>
              <div className="space-y-6">
                <p className="font-bold text-xs">مندوب شركة الشحن (المستلم)</p>
                <div className="border-b border-dotted border-paper-line w-36 mx-auto"></div>
              </div>
              <div className="space-y-6">
                <p className="font-bold text-xs">الختم الرسمي للمتجر</p>
                <div className="border border-dashed border-paper-line w-24 h-12 mx-auto rounded"></div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal 2: Quick Cash Settlement */}
      {settleCourier && (
        <CourierSettleModal
          courier={settleCourier}
          settleType={settleType}
          onSettleTypeChange={setSettleType}
          settleAmount={settleAmount}
          onSettleAmountChange={setSettleAmount}
          settleMethod={settleMethod}
          onSettleMethodChange={setSettleMethod}
          settleNotes={settleNotes}
          onSettleNotesChange={setSettleNotes}
          settleError={settleError}
          isPending={settlementMutation.isPending}
          onSubmit={() => settlementMutation.mutate()}
          onClose={() => setSettleCourier(null)}
        />
      )}

      {/* Modal 3: Add / Edit Courier Modal */}
      <CourierFormModal
        isOpen={isPartyModalOpen}
        isEditing={Boolean(editingCourier)}
        courierName={courierName}
        onNameChange={setCourierName}
        courierPhone={courierPhone}
        onPhoneChange={setCourierPhone}
        courierPhone2={courierPhone2}
        onPhone2Change={setCourierPhone2}
        courierAddress={courierAddress}
        onAddressChange={setCourierAddress}
        courierNotes={courierNotes}
        onNotesChange={setCourierNotes}
        initialBalance={initialBalance}
        onInitialBalanceChange={setInitialBalance}
        error={partyFormError}
        isPending={saveCourierMutation.isPending}
        onSubmit={() => saveCourierMutation.mutate()}
        onClose={() => setIsPartyModalOpen(false)}
      />
    </div>
  );
};
