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
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  FileText,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  RefreshCw,
  Wallet,
  Download,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { formatCurrency } from '@pos-mandob/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../data/store/useAuthStore';
import { exportManifestToExcel } from '../utils/excelExport';
import { CourierMobileCard } from '../components/mobile/CourierMobileCard';
import { nativeBackButton } from '../../platform/nativeBackButton';

export const CouriersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canDeleteParty } = usePermissions();

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
  const [manifestPaymentFilter, setManifestPaymentFilter] = useState<'ALL' | 'COD' | 'PREPAID'>('ALL');
  const [manifestSourceFilter, setManifestSourceFilter] = useState<'ALL' | 'WOOCOMMERCE' | 'DIRECT_SALE'>('ALL');
  const [manifestSearch, setManifestSearch] = useState<string>('');

  const user = useAuthStore((s) => s.user);
  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر إنجاز برو';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;

  // Quick Settlement Modal State
  const [settleCourier, setSettleCourier] = useState<any | null>(null);
  const [settleType, setSettleType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'CARD' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER'>('CASH');
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
  const { data: couriersData, isLoading } = useQuery({
    queryKey: ['couriers', search],
    queryFn: async () => {
      const res = await apiClient.get('/couriers', {
        params: { search: search || undefined },
      });
      return res.data;
    },
  });

  const couriers: any[] = couriersData?.data || [];
  const summary = couriersData?.summary || {
    total_couriers: 0,
    global_active_shipments: 0,
    global_pending_cod: 0,
    global_net_balance: 0,
  };

  // 2. Fetch Manifest for Selected Courier
  const { data: manifestData, isLoading: isManifestLoading } = useQuery({
    queryKey: ['courier-manifest', manifestCourier?.id],
    queryFn: async () => {
      if (!manifestCourier?.id) return null;
      const res = await apiClient.get(`/couriers/${manifestCourier.id}/manifest`);
      return res.data;
    },
    enabled: !!manifestCourier?.id,
  });

  const shipments: any[] = manifestData?.shipments || [];

  const filteredShipments = shipments.filter((s: any) => {
    if (manifestStatusFilter === 'IN_TRANSIT' && s.status !== 'SHIPPED_VIA_COURIER' && s.status !== 'IN_TRANSIT') return false;
    if (manifestStatusFilter === 'DELIVERED' && s.status !== 'DELIVERED') return false;
    if (manifestStatusFilter === 'RETURNED' && s.status !== 'RETURNED') return false;

    if (manifestPaymentFilter === 'COD' && s.is_paid_online) return false;
    if (manifestPaymentFilter === 'PREPAID' && !s.is_paid_online) return false;

    if (manifestSourceFilter === 'WOOCOMMERCE' && s.source !== 'WOOCOMMERCE') return false;
    if (manifestSourceFilter === 'DIRECT_SALE' && s.source !== 'DIRECT_SALE') return false;

    if (manifestSearch) {
      const term = manifestSearch.toLowerCase();
      const matchRef = s.reference?.toLowerCase().includes(term);
      const matchCust = s.customer_name?.toLowerCase().includes(term);
      const matchPhone = s.customer_phone?.includes(term);
      const matchTrack = s.tracking_number?.toLowerCase().includes(term);
      if (!matchRef && !matchCust && !matchPhone && !matchTrack) return false;
    }
    return true;
  });

  const filteredMetrics = {
    total: filteredShipments.length,
    inTransit: filteredShipments.filter((s: any) => s.status === 'SHIPPED_VIA_COURIER' || s.status === 'IN_TRANSIT').length,
    delivered: filteredShipments.filter((s: any) => s.status === 'DELIVERED').length,
    returned: filteredShipments.filter((s: any) => s.status === 'RETURNED').length,
    totalCod: filteredShipments.reduce((sum: number, s: any) => sum + (s.is_paid_online ? 0 : Number(s.cod_amount ?? s.total)), 0),
    totalShippingFees: filteredShipments.reduce((sum: number, s: any) => sum + Number(s.shipping_cost || 0), 0),
    prepaidCount: filteredShipments.filter((s: any) => s.is_paid_online).length,
  };

  // 3. Create / Update Courier Mutation
  const saveCourierMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type: 'COURIER',
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

  // 5. Quick Settlement Mutation (Payment Voucher / Receipt Voucher)
  const settlementMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/payments', {
        party_id: settleCourier.id,
        type: settleType,
        amount: Number(settleAmount),
        method: settleMethod,
        notes: settleNotes.trim() || (settleType === 'RECEIPT' ? `توريد كاش COD - شركة ${settleCourier.name}` : `سداد أتعاب شحن - شركة ${settleCourier.name}`),
        date: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couriers'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setSettleCourier(null);
      showNotification('success', settleType === 'RECEIPT' ? 'تم تسجيل سند القبض وتوريد الكاش للخزينة بنجاح' : 'تم تسجيل سند الصرف وخصم المبلغ من الخزينة بنجاح');
    },
    onError: (err: any) => {
      setSettleError(err.response?.data?.message || 'تعذر تسجيل السند');
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

  const openSettleModal = (c: any, defaultType: 'RECEIPT' | 'PAYMENT' = 'RECEIPT') => {
    setSettleCourier(c);
    setSettleType(defaultType);
    setSettleAmount(c.pending_cod_amount > 0 ? c.pending_cod_amount : Math.abs(Number(c.balance) || 0));
    setSettleMethod('CASH');
    setSettleNotes('');
    setSettleError(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* Feedback Toast Notification */}
      {feedback && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <Truck className="w-5 h-5" />
            </div>
            <span>شركات الشحن والتوصيل</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة حسابات شركات الشحن، متابعة تسليم الطرود، ومطابقة وتصفية مبالغ الدفع عند الاستلام (COD) مع الخزينة.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة شركة شحن جديدة</span>
        </button>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">شركات الشحن</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">{summary.total_couriers}</div>
          <span className="text-[10px] text-slate-400 font-medium">شركة مسجلة بالدفاتر</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600">طرود قيد التوصيل</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-700 mt-2">{summary.global_active_shipments}</div>
          <span className="text-[10px] text-slate-400 font-medium">في عهدة شركات الشحن حالياً</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600">مبالغ قيد التحصيل (COD)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-blue-700 mt-2 font-mono">{formatCurrency(summary.global_pending_cod)}</div>
          <span className="text-[10px] text-slate-400 font-medium">مستحقات معلقة جاري تحصيلها</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">صافي الأرصدة الدفترية</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-700 mt-2 font-mono">{formatCurrency(summary.global_net_balance)}</div>
          <span className="text-[10px] text-slate-400 font-medium">رصيد شركات الشحن المالي</span>
        </div>
      </div>

      {/* Main Couriers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باسم شركة الشحن أو الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 focus:bg-white"
            />
          </div>
          <div className="text-xs text-slate-500 font-bold">
            إجمالي الشركات: <span className="text-purple-700 font-black">{couriers.length}</span>
          </div>
        </div>

        {/* Table View */}
        {isLoading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
            <span>جاري تحميل بيانات شركات الشحن...</span>
          </div>
        ) : couriers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full mx-auto flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">لا توجد شركات شحن مسجلة حتى الآن</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              اضغط على "إضافة شركة شحن جديدة" لتسجيل شركات الشحن المحلية أو الخارجية وبدء متابعة الشحنات وتسوية الكاش.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">شركة الشحن</th>
                  <th className="py-3 px-4">بيانات التواصل والعنوان</th>
                  <th className="py-3 px-4 text-center">الطرود في العهدة</th>
                  <th className="py-3 px-4 text-center">مبالغ قيد التحصيل (COD)</th>
                  <th className="py-3 px-4 text-center">الرصيد المالي بالدفاتر</th>
                  <th className="py-3 px-4 text-left">إجراءات المتابعة والتسوية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {couriers.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{c.name}</span>
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded border border-purple-200">
                          شركة شحن
                        </span>
                      </div>
                      {c.notes && <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs truncate">{c.notes}</p>}
                    </td>

                    <td className="py-3 px-4">
                      {c.phone ? (
                        <div className="flex items-center gap-1 text-slate-700 font-mono text-xs">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">بدون هاتف</span>
                      )}
                      {c.address && (
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span>{c.address}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {c.active_shipments_count > 0 ? (
                        <button
                          onClick={() => setManifestCourier(c)}
                          className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Package className="w-3 h-3 text-amber-600" />
                          <span>{c.active_shipments_count} طرد قيد التوصيل</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">لا توجد شحنات معلقة</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="font-bold font-mono text-blue-700 text-xs">
                        {formatCurrency(c.pending_cod_amount || 0)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-mono">
                      {Number(c.balance) !== 0 ? (
                        <span
                          className={`font-black text-xs px-2 py-0.5 rounded-lg ${
                            Number(c.balance) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {formatCurrency(c.balance)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">0.00 (خالص)</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Manifest Button */}
                        <button
                          onClick={() => setManifestCourier(c)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="كشف البوالص والشحنات التفصيلي (Manifest)"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">كشف الشحنات</span>
                        </button>

                        {/* Ledger Button */}
                        <button
                          onClick={() => navigate(`/ledger/${c.id}`)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="كشف الحساب المالي التفصيلي"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">كشف الحساب</span>
                        </button>

                        {/* Settle Cash Button */}
                        <button
                          onClick={() => openSettleModal(c, 'RECEIPT')}
                          className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer border border-emerald-200"
                          title="توريد كاش COD للخزينة"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                          <span>قبض كاش</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        {canDeleteParty && (
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف شركة الشحن "${c.name}"؟`)) {
                                deleteCourierMutation.mutate(c.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            {/* Mobile Cards View (md:hidden) */}
            <div className="md:hidden space-y-3 p-3 bg-slate-50/60">
              {couriers.map((c: any) => (
                <CourierMobileCard
                  key={c.id}
                  courier={c}
                  canDeleteParty={canDeleteParty}
                  onOpenManifest={(cour) => setManifestCourier(cour)}
                  onOpenSettle={(cour, type) => openSettleModal(cour, type)}
                  onOpenLedger={(id) => navigate(`/ledger/${id}`)}
                  onEditCourier={(cour) => openEditModal(cour)}
                  onDeleteCourier={(id, name) => {
                    if (confirm(`هل أنت متأكد من حذف شركة الشحن "${name}"؟`)) {
                      deleteCourierMutation.mutate(id);
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal 1: Manifest Modal (كشف الشحنات والبوالص التفصيلي لكل شركة شحن) */}
      {manifestCourier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    كشف شحنات وبوالص: {manifestCourier.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    متابعة كافة فواتير وأوردرات المتجر المسندة لشركة الشحن ومطابقة التحصيلات
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManifestCourier(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-center">
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">إجمالي المعروض</span>
                <span className="text-sm font-black text-slate-900">{filteredMetrics.total}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-amber-600 font-bold block">قيد التوصيل (عهدة)</span>
                <span className="text-sm font-black text-amber-700">{filteredMetrics.inTransit}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-emerald-600 font-bold block">تم التسليم</span>
                <span className="text-sm font-black text-emerald-700">{filteredMetrics.delivered}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-purple-600 font-bold block">مطلوب COD</span>
                <span className="text-sm font-black text-purple-700 font-mono">
                  {formatCurrency(filteredMetrics.totalCod)}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-indigo-600 font-bold block">أتعاب الشحن</span>
                <span className="text-sm font-black text-indigo-700 font-mono">
                  {formatCurrency(filteredMetrics.totalShippingFees)}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-teal-600 font-bold block">مدفوع أونلاين</span>
                <span className="text-sm font-black text-teal-700">{filteredMetrics.prepaidCount}</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3 border-b border-slate-100 space-y-2 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Status Filter */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-400 ml-1">الحالة:</span>
                  {[
                    { key: 'ALL', label: 'الكل' },
                    { key: 'IN_TRANSIT', label: 'قيد التوصيل' },
                    { key: 'DELIVERED', label: 'تم التسليم' },
                    { key: 'RETURNED', label: 'مرتجع' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setManifestStatusFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                        manifestStatusFilter === tab.key
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Payment Method Filter */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-400 ml-1">الدفع:</span>
                  {[
                    { key: 'ALL', label: 'الكل' },
                    { key: 'COD', label: 'دفع عند الاستلام (COD)' },
                    { key: 'PREPAID', label: 'مدفوع مسبقاً (أونلاين)' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setManifestPaymentFilter(tab.key as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                        manifestPaymentFilter === tab.key
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Source Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-400 ml-1">المصدر:</span>
                  {[
                    { key: 'ALL', label: 'الكل' },
                    { key: 'WOOCOMMERCE', label: 'ووكومرس' },
                    { key: 'DIRECT_SALE', label: 'مباشر (POS)' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setManifestSourceFilter(tab.key as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                        manifestSourceFilter === tab.key
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث سريع برقم الطلب، اسم العميل، رقم الهاتف، أو رقم البوليصة..."
                  value={manifestSearch}
                  onChange={(e) => setManifestSearch(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white transition"
                />
              </div>
            </div>

            {/* Shipments Table */}
            <div className="flex-1 overflow-y-auto p-3">
              {isManifestLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 font-bold">جاري تحميل كشف البوالص...</div>
              ) : filteredShipments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-bold">لا توجد شحنات مطابقة للبحث أو الفلتر</div>
              ) : (
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[11px] font-black border-b border-slate-200">
                      <th className="py-2.5 px-3 text-center w-8">م</th>
                      <th className="py-2.5 px-3">رقم الطلب / المصدر</th>
                      <th className="py-2.5 px-3">العميل والتوصيل</th>
                      <th className="py-2.5 px-3">البوليصة</th>
                      <th className="py-2.5 px-3 text-center">نوع التحصيل ومبلغ COD</th>
                      <th className="py-2.5 px-3 text-center">أجرة الشحن</th>
                      <th className="py-2.5 px-3 text-center">إجمالي الطلب</th>
                      <th className="py-2.5 px-3 text-center">حالة الشحنة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShipments.map((s: any, idx: number) => (
                      <tr key={s.id + s.source} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-400">
                          {idx + 1}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-bold font-mono text-purple-700 block">{s.reference}</span>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                            {s.source === 'WOOCOMMERCE' ? 'ووكومرس' : 'فاتورة مباشرة'}
                          </span>
                          {s.shipped_at && (
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{s.shipped_at}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{s.customer_name}</span>
                          {s.customer_phone && (
                            <span className="text-[11px] font-mono text-slate-500 block" dir="ltr">{s.customer_phone}</span>
                          )}
                          {s.customer_address && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                              {s.city ? `${s.city} - ` : ''}
                              {s.customer_address}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {s.tracking_number ? (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-800 rounded text-[11px] font-bold border border-purple-200">
                              {s.tracking_number}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">بدون بوليصة</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {s.is_paid_online ? (
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-black">
                              مدفوع مسبقاً (تحصيل: 0 ج.م)
                            </span>
                          ) : (
                            <div>
                              <span className="font-mono font-black text-slate-900 text-sm block">
                                {formatCurrency(s.cod_amount ?? s.total)}
                              </span>
                              <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1 rounded">
                                دفع عند الاستلام (COD)
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">
                          {formatCurrency(s.shipping_cost || 0)}
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {formatCurrency(s.total)}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black border ${
                              s.status === 'DELIVERED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : s.status === 'RETURNED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {s.status_label}
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">
                            {s.payment_status_label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportManifestToExcel(filteredShipments, manifestCourier?.name || 'شركة_الشحن')}
                  disabled={filteredShipments.length === 0}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="تصدير الشحنات إلى ملف Excel"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تصدير Excel</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كشف A4 رسمي</span>
                </button>
              </div>

              <button
                onClick={() => setManifestCourier(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Dedicated Corporate Printable Manifest Sheet (A4 Print-Only)              */}
          {/* ========================================================================= */}
          <div className="print-only printable-area font-sans text-slate-900 leading-relaxed text-xs" dir="rtl">
            {/* Store Letterhead */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between">
              <div className="space-y-1">
                <h1 className="text-xl font-black text-slate-900">{storeName}</h1>
                <p className="text-xs font-bold text-slate-600">نظام إدارة نقاط البيع والمخازن والشحنات</p>
                {storePhone && <p className="text-[11px] text-slate-500 font-mono">الهاتف: {storePhone}</p>}
                {storeAddress && <p className="text-[11px] text-slate-500">{storeAddress}</p>}
              </div>

              <div className="text-left space-y-1">
                <div className="inline-block bg-slate-900 text-white font-black px-3 py-1 rounded text-sm">
                  مانيفست تسليم بوالص وشحنات
                </div>
                <p className="text-xs font-black text-slate-900">
                  شركة الشحن: {manifestCourier.name}
                </p>
                {manifestCourier.phone && (
                  <p className="text-[11px] text-slate-600 font-mono" dir="ltr">
                    هاتف المندوب/الشركة: {manifestCourier.phone}
                  </p>
                )}
                <p className="text-[10px] text-slate-500 font-mono">
                  تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
                </p>
              </div>
            </div>

            {/* Manifest Summary Bar in Print */}
            <div className="grid grid-cols-5 gap-2 p-2.5 bg-slate-50 border border-slate-300 rounded mb-4 text-center">
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">إجمالي الطرود</span>
                <span className="text-sm font-black text-slate-900">{filteredMetrics.total}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">قيد التوصيل بالعهدة</span>
                <span className="text-sm font-black text-amber-700">{filteredMetrics.inTransit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">تم التسليم</span>
                <span className="text-sm font-black text-emerald-700">{filteredMetrics.delivered}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">مطلوب تحصيله (COD)</span>
                <span className="text-sm font-black text-purple-800 font-mono">{formatCurrency(filteredMetrics.totalCod)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">إجمالي أتعاب الشحن</span>
                <span className="text-sm font-black text-slate-800 font-mono">{formatCurrency(filteredMetrics.totalShippingFees)}</span>
              </div>
            </div>

            {/* A4 Manifest Print Table */}
            <table className="w-full text-right border-collapse border border-slate-300 text-[10px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-300">
                  <th className="p-1.5 border border-slate-300 text-center w-8">م</th>
                  <th className="p-1.5 border border-slate-300">رقم الطلب / المصدر</th>
                  <th className="p-1.5 border border-slate-300">اسم العميل ورقم الهاتف</th>
                  <th className="p-1.5 border border-slate-300">المدينة والعنوان</th>
                  <th className="p-1.5 border border-slate-300 text-center">رقم البوليصة</th>
                  <th className="p-1.5 border border-slate-300 text-center">نوع التحصيل</th>
                  <th className="p-1.5 border border-slate-300 text-center">مطلوب COD</th>
                  <th className="p-1.5 border border-slate-300 text-center">أجرة الشحن</th>
                  <th className="p-1.5 border border-slate-300 text-center">حالة التوصيل</th>
                  <th className="p-1.5 border border-slate-300 text-center w-28">توقيع المستلم وملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredShipments.map((s: any, idx: number) => (
                  <tr key={s.id + s.source} className="border-b border-slate-200">
                    <td className="p-1.5 border border-slate-300 text-center font-bold font-mono">{idx + 1}</td>
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold font-mono block">{s.reference}</span>
                      <span className="text-[9px] text-slate-500">{s.source === 'WOOCOMMERCE' ? 'ووكومرس' : 'مباشر'}</span>
                    </td>
                    <td className="p-1.5 border border-slate-300">
                      <span className="font-bold block">{s.customer_name}</span>
                      <span className="font-mono text-[9px] text-slate-600" dir="ltr">{s.customer_phone || '—'}</span>
                    </td>
                    <td className="p-1.5 border border-slate-300">
                      {[s.city, s.customer_address].filter(Boolean).join(' - ') || '—'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-mono font-bold">
                      {s.tracking_number || '—'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-bold">
                      {s.is_paid_online ? 'أونلاين (مدفوع)' : 'عند الاستلام (COD)'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-mono font-black text-slate-900">
                      {s.is_paid_online ? '0.00 ج.م' : formatCurrency(s.cod_amount ?? s.total)}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-mono">
                      {formatCurrency(s.shipping_cost || 0)}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-bold">
                      {s.status_label || s.status}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center text-[9px] text-slate-400">
                      {/* توقيع أو ملاحظة استلام */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures Footer */}
            <div className="mt-8 pt-4 border-t-2 border-slate-400 grid grid-cols-3 gap-4 text-center">
              <div className="space-y-6">
                <p className="font-bold text-xs">مسؤول تسليم الشحنات (المحل)</p>
                <div className="border-b border-dotted border-slate-400 w-36 mx-auto"></div>
              </div>
              <div className="space-y-6">
                <p className="font-bold text-xs">مندوب شركة الشحن (المستلم)</p>
                <div className="border-b border-dotted border-slate-400 w-36 mx-auto"></div>
              </div>
              <div className="space-y-6">
                <p className="font-bold text-xs">الختم الرسمي للمتجر</p>
                <div className="border border-dashed border-slate-300 w-24 h-12 mx-auto rounded"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Quick Cash Settlement (تسوية كاش سريعة مع الخزينة) */}
      {settleCourier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-600" />
                <span>تسوية نقدية: {settleCourier.name}</span>
              </h3>
              <button onClick={() => setSettleCourier(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type Toggle: Receipt (توريد كاش) vs Payment (سداد أتعاب) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettleType('RECEIPT')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  settleType === 'RECEIPT'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>قبض وتوريد كاش COD 🟢</span>
              </button>

              <button
                type="button"
                onClick={() => setSettleType('PAYMENT')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  settleType === 'PAYMENT'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                <span>صرف أتعاب شحن 🔴</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {settleType === 'RECEIPT'
                ? 'استلام مبالغ التحصيلات من شركة الشحن وإيداعها في خزينة المتجر وإقفال مديونية الشركة.'
                : 'صرف نقدية من الخزينة لشركة الشحن مقابل أجور الشحن والتوصيل.'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المراد تسويته (ج.م) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع والتوريد:</label>
                <select
                  value={settleMethod}
                  onChange={(e: any) => setSettleMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="CASH">نقدي (كاش بالخزينة)</option>
                  <option value="INSTAPAY">تحويل إنستاباي (InstaPay)</option>
                  <option value="VODAFONE_CASH">محفظة فودافون كاش ومحافظ</option>
                  <option value="TRANSFER">تحويل بنكي</option>
                  <option value="CARD">بطاقة بنكية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات أو رقم الحوالة / الإيصال (اختياري):</label>
                <input
                  type="text"
                  placeholder="مثال: تصفية أوردرات الأسبوع / تحويل إنستاباي رقم..."
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            {settleError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200 font-bold">
                {settleError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettleCourier(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={settlementMutation.isPending || settleAmount <= 0}
                onClick={() => settlementMutation.mutate()}
                className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {settlementMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>تأكيد وتسجيل السند</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Add / Edit Courier Modal */}
      {isPartyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-600" />
                <span>{editingCourier ? 'تعديل شركة شحن' : 'إضافة شركة شحن جديدة للدفاتر'}</span>
              </h3>
              <button onClick={() => setIsPartyModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم شركة الشحن / المندوب *</label>
                <input
                  type="text"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="مثال: شركة بوسطة / شركة طيارة / مندوب المحلة"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الهاتف الأساسي</label>
                  <input
                    type="text"
                    value={courierPhone}
                    onChange={(e) => setCourierPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">هاتف إضافي</label>
                  <input
                    type="text"
                    value={courierPhone2}
                    onChange={(e) => setCourierPhone2(e.target.value)}
                    placeholder="اختياري"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان أو مناطق التغطية</label>
                <input
                  type="text"
                  value={courierAddress}
                  onChange={(e) => setCourierAddress(e.target.value)}
                  placeholder="مثال: القاهرة والجيزة / طنطا والمحافظات"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الحساب أو الاتفاق</label>
                <input
                  type="text"
                  value={courierNotes}
                  onChange={(e) => setCourierNotes(e.target.value)}
                  placeholder="مثال: تصفية كاش كل يوم خميس / سعر البوليصة 45 ج"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              {!editingCourier && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الافتتاحي (إن وُجد)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono"
                  />
                </div>
              )}
            </div>

            {partyFormError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200 font-bold">
                {partyFormError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPartyModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={saveCourierMutation.isPending || !courierName.trim()}
                onClick={() => saveCourierMutation.mutate()}
                className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {saveCourierMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingCourier ? 'حفظ التعديلات' : 'إضافة الشركة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
