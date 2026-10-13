import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Search,
  Truck,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  MapPin,
  DollarSign,
  RotateCcw,
  RefreshCw,
  Package,
  Copy,
  Check,
  Printer,
  Building2,
  Plus,
  Calendar,
  Eye,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../data/store/useAuthStore';
import { formatCurrency } from '@pos-mandob/shared';
import { DateRangeFilter, calculatePresetDates } from '../components/common/DateRangeFilter';
import { MobileFilterChips } from '../components/mobile/MobileFilterChips';
import { WcOrderMobileCard } from '../components/mobile/WcOrderMobileCard';
import { PosReceiptModal } from '../components/pos/PosReceiptModal';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useHaptic } from '../hooks/useHaptic';

const cleanItemName = (name?: string): string => {
  if (!name) return '';
  return name.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};

const formatOrderDate = (order: any): string => {
  const dateStr = order?.order_date || order?.created_at;
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateStr);
  }
};

export const WcOrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { selection } = useHaptic();
  const { isOwnerOrAdmin, isManager, isMandob } = usePermissions();
  const canPullOrders = isOwnerOrAdmin || isManager;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(() => calculatePresetDates('today').from);
  const [toDate, setToDate] = useState<string>(() => calculatePresetDates('today').to);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  // Modals state
  const [confirmModalOrder, setConfirmModalOrder] = useState<any | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [forceConfirm, setForceConfirm] = useState<boolean>(false);

  const [dispatchModalOrder, setDispatchModalOrder] = useState<any | null>(null);
  const [selectedMandobId, setSelectedMandobId] = useState<number | ''>('');

  // Courier Dispatch Modal state
  const [courierModalOrder, setCourierModalOrder] = useState<any | null>(null);
  const [courierName, setCourierName] = useState<string>('');
  const [courierPartyId, setCourierPartyId] = useState<number | ''>('');
  const [courierTrackingNumber, setCourierTrackingNumber] = useState<string>('');
  const [courierBranchId, setCourierBranchId] = useState<number | ''>('');
  const [copiedTrackingId, setCopiedTrackingId] = useState<number | null>(null);

  // Quick Add Courier state
  const [showAddCourier, setShowAddCourier] = useState<boolean>(false);
  const [newCourierName, setNewCourierName] = useState<string>('');
  const [newCourierPhone, setNewCourierPhone] = useState<string>('');
  const [newCourierNotes, setNewCourierNotes] = useState<string>('');
  const [addCourierError, setAddCourierError] = useState<string | null>(null);

  const [deliverModalOrder, setDeliverModalOrder] = useState<any | null>(null);
  const [collectedAmount, setCollectedAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'INSTAPAY' | 'VODAFONE_CASH' | 'TRANSFER' | 'COURIER_COD'>('CASH');

  const openDeliverModal = (order: any) => {
    setDeliverModalOrder(order);
    const isPaidOnline =
      order.payment_status === 'PAID_ONLINE' ||
      (order.wc_payment_method && order.wc_payment_method !== 'cod');
    setCollectedAmount(isPaidOnline ? 0 : Number(order.total || 0));
    if (isPaidOnline) {
      setPaymentMethod('CARD');
    } else if (order.courier_party_id) {
      setPaymentMethod('COURIER_COD');
    } else {
      setPaymentMethod('CASH');
    }
  };

  const [printOrder, setPrintOrder] = useState<any | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Register active modal with Android hardware back button
  React.useEffect(() => {
    const isAnyModalOpen =
      Boolean(viewingOrder) ||
      Boolean(confirmModalOrder) ||
      Boolean(courierModalOrder) ||
      Boolean(dispatchModalOrder) ||
      Boolean(deliverModalOrder) ||
      Boolean(printOrder);

    if (!isAnyModalOpen) return;

    const unregister = nativeBackButton.register(() => {
      if (printOrder) {
        setPrintOrder(null);
        return true;
      }
      if (deliverModalOrder) {
        setDeliverModalOrder(null);
        return true;
      }
      if (courierModalOrder) {
        setCourierModalOrder(null);
        return true;
      }
      if (dispatchModalOrder) {
        setDispatchModalOrder(null);
        return true;
      }
      if (confirmModalOrder) {
        setConfirmModalOrder(null);
        return true;
      }
      if (viewingOrder) {
        setViewingOrder(null);
        return true;
      }
      return false;
    });

    return () => {
      unregister();
    };
  }, [
    viewingOrder,
    confirmModalOrder,
    courierModalOrder,
    dispatchModalOrder,
    deliverModalOrder,
    printOrder,
  ]);

  const user = useAuthStore((state) => state.user);

  // Fetch Branches safely
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/branches');
        const list = res.data?.data ?? res.data;
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
  });
  const branches = Array.isArray(branchesData) ? branchesData : [];

  // Fetch Employees safely (for mandob dispatch)
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/employees');
        const list = res.data?.data ?? res.data;
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
  });
  const employees = Array.isArray(employeesData) ? employeesData : [];
  const mandobs = employees.filter((e: any) => {
    const isMandobRole = e.role === 'MANDOB' || e.role === 'MANAGER';
    if (isManager && user?.branch_id) {
      return isMandobRole && e.branch_id === user.branch_id;
    }
    return isMandobRole;
  });

  // Fetch Couriers safely (for courier dispatch)
  const { data: couriersData } = useQuery({
    queryKey: ['parties', 'COURIER'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/parties', { params: { type: 'COURIER' } });
        const list = res.data?.data ?? res.data;
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
  });
  const couriers = Array.isArray(couriersData) ? couriersData : [];

  const openCourierModal = (order: any) => {
    setCourierModalOrder(order);
    const matchedParty = couriers.find((c: any) => c.id === order.courier_party_id || c.name === order.courier_name);
    setCourierPartyId(matchedParty?.id || order.courier_party_id || '');
    setCourierName(matchedParty?.name || order.courier_name || '');
    setCourierTrackingNumber(order.tracking_number || '');
    const mainBranch = branches.find((b: any) => b.is_main) || branches[0];
    setCourierBranchId(order.branch_id || (mainBranch?.id ?? ''));
    setShowAddCourier(false);
    setNewCourierName('');
    setNewCourierPhone('');
    setNewCourierNotes('');
    setAddCourierError(null);
  };

  // Fetch WooCommerce Orders safely
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['wc-orders', search, statusFilter, fromDate, toDate],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (fromDate) params.date_from = fromDate;
      if (toDate) params.date_to = toDate;

      const res = await apiClient.get('/wc-orders', { params });
      const raw = res.data?.data?.data ?? res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });
  const orders = Array.isArray(ordersData) ? ordersData : [];

  // Confirm Mutation
  const confirmMutation = useMutation({
    mutationFn: async ({
      orderId,
      branchId,
      force,
    }: {
      orderId: number;
      branchId: number;
      force?: boolean;
    }) => {
      return apiClient.post(`/wc-orders/${orderId}/confirm`, {
        branch_id: branchId,
        force: force || false,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wc-orders'] });
      setConfirmModalOrder(null);
      setConfirmError(null);
      setForceConfirm(false);
      setFeedback({ type: 'success', message: res.data?.message || 'تم تأكيد الطلب بنجاح' });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'فشل تأكيد الطلب';
      setConfirmError(msg);
      setFeedback({ type: 'error', message: msg });
      setTimeout(() => setFeedback(null), 10000);
    },
  });

  // Dispatch Mutation
  const dispatchMutation = useMutation({
    mutationFn: async ({ orderId, mandobId }: { orderId: number; mandobId: number }) => {
      return apiClient.post(`/wc-orders/${orderId}/dispatch`, { mandob_id: mandobId });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wc-orders'] });
      setDispatchModalOrder(null);
      setFeedback({ type: 'success', message: res.data?.message || 'تم إسناد الطلب للمندوب' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل إسناد الطلب' });
    },
  });

  // Courier Dispatch Mutation
  const courierDispatchMutation = useMutation({
    mutationFn: async ({
      orderId,
      courierName,
      courierPartyId,
      trackingNumber,
      branchId,
    }: {
      orderId: number;
      courierName: string;
      courierPartyId?: number | null;
      trackingNumber?: string | null;
      branchId?: number | null;
    }) => {
      return apiClient.post(`/wc-orders/${orderId}/dispatch-courier`, {
        courier_name: courierName,
        courier_party_id: courierPartyId || undefined,
        tracking_number: trackingNumber || undefined,
        branch_id: branchId || undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wc-orders'] });
      setCourierModalOrder(null);
      setFeedback({ type: 'success', message: res.data?.message || 'تم إسناد الطلب لشركة الشحن بنجاح' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل إسناد الطلب لشركة الشحن' });
    },
  });

  // Create Courier Mutation
  const createCourierMutation = useMutation({
    mutationFn: async (payload: { name: string; phone?: string; notes?: string }) => {
      return apiClient.post('/parties', {
        ...payload,
        type: 'COURIER',
      });
    },
    onSuccess: (res) => {
      const newParty = res.data?.data;
      queryClient.invalidateQueries({ queryKey: ['parties', 'COURIER'] });
      if (newParty) {
        setCourierPartyId(newParty.id);
        setCourierName(newParty.name);
      }
      setShowAddCourier(false);
      setNewCourierName('');
      setNewCourierPhone('');
      setNewCourierNotes('');
      setAddCourierError(null);
      setFeedback({ type: 'success', message: 'تمت إضافة شركة الشحن بنجاح واختيارها' });
      setTimeout(() => setFeedback(null), 3000);
    },
    onError: (err: any) => {
      setAddCourierError(err.response?.data?.message || 'فشل إضافة شركة الشحن');
    },
  });

  const handleCreateCourier = () => {
    if (!newCourierName.trim()) {
      setAddCourierError('اسم شركة الشحن مطلوب');
      return;
    }
    setAddCourierError(null);
    createCourierMutation.mutate({
      name: newCourierName.trim(),
      phone: newCourierPhone.trim() || undefined,
      notes: newCourierNotes.trim() || undefined,
    });
  };

  // Deliver Mutation
  const deliverMutation = useMutation({
    mutationFn: async ({ orderId, amount, method }: { orderId: number; amount: number; method: string }) => {
      return apiClient.post(`/wc-orders/${orderId}/deliver`, {
        collected_amount: amount,
        payment_method: method,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wc-orders'] });
      queryClient.invalidateQueries({ queryKey: ['couriers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeliverModalOrder(null);
      setFeedback({ type: 'success', message: res.data?.message || 'تم تسليم الطلب وإصدار الفاتورة' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل تسليم الطلب' });
    },
  });

  // Return Mutation
  const returnMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiClient.post(`/wc-orders/${orderId}/return`, { reason: 'رفض العميل الاستلام' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wc-orders'] });
      setFeedback({ type: 'success', message: 'تم تسجيل الطلب كمرتجع' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل تسجيل المرتجع' });
    },
  });

  // Pull Recent Orders Mutation (Instant Pull without webhook)
  const pullMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/wc-orders/pull');
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['wc-orders'] });
      setFeedback({
        type: 'success',
        message: res.data?.message || 'تم سحب وتحديث الطلبات بنجاح ✅',
      });
      setTimeout(() => setFeedback(null), 4500);
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'فشل سحب الطلبات من المتجر',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_CONFIRMATION':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            بانتظار التأكيد
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            مؤكد وقيد التجهيز
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            مع المندوب
          </span>
        );
      case 'SHIPPED_VIA_COURIER':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
            <Package className="w-3 h-3" />
            مع شركة الشحن
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            تم التسليم والتحصيل
          </span>
        );
      case 'RETURNED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            مرتجع
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Desktop Header (hidden on mobile) */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">طلبيات ووكومرس والتوصيل الميداني</h1>
            <p className="text-xs text-slate-500 mt-1">
              متابعة وتأكيد طلبات المتجر، التوزيع على المناديب وسيارات التوصيل، والتسليم على باب البيت
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          {canPullOrders && (
            <button
              onClick={() => pullMutation.mutate()}
              disabled={pullMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${pullMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{pullMutation.isPending ? 'جاري سحب الطلبات...' : '🔄 سحب وتحديث الطلبات الآن'}</span>
            </button>
          )}

          {/* Search */}
          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب أو العميل أو الهاتف..."
              className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-gradient-to-l from-amber-600 to-orange-600 rounded-2xl p-3.5 text-white shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold opacity-90">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>طلبيات المتجر ({orders.length})</span>
          </div>
          <h3 className="text-xl font-black mt-0.5 tracking-tight">
            {formatCurrency(orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0))}
          </h3>
        </div>
        {canPullOrders && (
          <button
            type="button"
            onClick={() => pullMutation.mutate()}
            disabled={pullMutation.isPending}
            className="px-3 py-2 bg-white text-amber-700 hover:bg-amber-50 rounded-xl font-black text-xs shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${pullMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{pullMutation.isPending ? 'جاري السحب...' : 'سحب الطلبات'}</span>
          </button>
        )}
      </div>

      {/* Mobile Search Bar (md:hidden) */}
      <div className="md:hidden w-full relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالطلب أو العميل أو الهاتف..."
          className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs text-right"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            )}
            <span className="text-xs font-bold whitespace-pre-line leading-relaxed">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs (Horizontal scroll on mobile) */}
      <MobileFilterChips
        options={[
          { id: 'ALL', label: 'كافة الطلبات' },
          { id: 'PENDING_CONFIRMATION', label: 'بانتظار التأكيد' },
          { id: 'CONFIRMED', label: 'مؤكدة وقيد التجهيز' },
          { id: 'DISPATCHED', label: 'مع المناديب' },
          { id: 'SHIPPED_VIA_COURIER', label: 'مع شركات الشحن' },
          { id: 'DELIVERED', label: 'تم تسليمها' },
          { id: 'RETURNED', label: 'مرتجع' },
        ]}
        selectedId={statusFilter}
        onSelect={(id) => setStatusFilter(id)}
      />

      {/* Date Range Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm w-full min-w-0 max-w-full overflow-hidden">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          defaultPreset="today"
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-bold text-xs">جاري تحميل الطلبيات...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600">لا توجد طلبيات تطابق الفلتر المحدد</p>
          <p className="text-xs text-slate-400">أي طلب يتم على متجرك في ووكومرس سيظهر هنا فورياً لتجهيزه وشحنه.</p>
        </div>
      ) : (
        <>
          {/* Mobile Orders View: Dedicated Ergonomic Thumb-First Cards */}
          <div className="space-y-3.5 lg:hidden">
            {orders.map((order: any) => (
              <WcOrderMobileCard
                key={order.id}
                order={order}
                onViewDetails={(o) => setViewingOrder(o)}
                onPrint={(o) => setPrintOrder(o)}
                onConfirm={(o) => {
                  setConfirmModalOrder(o);
                  setSelectedBranchId(o.branch_id || (branches[0]?.id ?? ''));
                  setConfirmError(null);
                  setForceConfirm(false);
                }}
                onAssignCourier={(o) => openCourierModal(o)}
                onAssignMandob={(o) => {
                  setDispatchModalOrder(o);
                  setSelectedMandobId(o.mandob_id || (mandobs[0]?.id ?? ''));
                }}
                onDeliver={(o) => openDeliverModal(o)}
                canConfirm={isOwnerOrAdmin || isManager}
                canDispatch={isOwnerOrAdmin || isManager}
                canDeliver={isOwnerOrAdmin || isManager || isMandob}
              />
            ))}
          </div>

          {/* Desktop Orders View: Full Grid */}
          <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {orders.map((order: any) => (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              {/* Order Header */}
              <div className="space-y-2 border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setViewingOrder(order)}
                      className="text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-2.5 py-0.5 rounded-lg font-mono transition-colors cursor-pointer flex items-center gap-1"
                      title="اضغط لعرض تفاصيل الطلب والصور"
                    >
                      <span>#{order.wc_order_id}</span>
                      <span>🛒</span>
                    </button>
                    {(order.order_date || order.created_at) && (
                      <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg font-sans">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatOrderDate(order)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingOrder(order)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                      title="عرض تفاصيل الأوردر الكاملة والصور"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {order.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => setPrintOrder(order)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                        title="طباعة بوليصة التوصيل / الفاتورة"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    )}
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {(() => {
                  const phone = order.customer_phone || order.party?.phone;
                  const address = order.customer_address || order.party?.address;
                  const gov = order.governorate || order.city;

                  return (
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{order.customer_name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1.5 font-mono">
                        {phone ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${phone}`}
                              className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-xl active:scale-95 transition-all"
                              title="اتصال هاتفي مباشر"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{phone}</span>
                            </a>
                            <a
                              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-xs active:scale-90 transition-all flex items-center justify-center"
                              title="محادثة واتساب"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                              </svg>
                            </a>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Phone className="w-3 h-3 text-slate-300" /> -
                          </span>
                        )}
                        {gov && (
                          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {gov}
                          </span>
                        )}
                      </div>
                      {address && (
                        <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1 truncate font-sans">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{address}</span>
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    الأصناف المطلوبة ({order.items_snapshot?.length || 0}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewingOrder(order)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>التفاصيل والصور</span>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {(order.items_snapshot || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={cleanItemName(item.name)}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-200/60 flex items-center justify-center shrink-0 text-slate-400">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-800 truncate block text-[11px]">{cleanItemName(item.name)}</span>
                        {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {item.attributes.map((attr: any, aIdx: number) => (
                              <span key={aIdx} className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-600 font-bold">
                                {attr.key}: {attr.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-[11px] font-black text-slate-700 shrink-0">
                        × {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1 text-[11px] border border-slate-100">
                <div className="flex justify-between text-slate-500">
                  <span>الشحن:</span>
                  <span className="font-mono font-bold">{formatCurrency(order.shipping_cost)}</span>
                </div>
                {order.discount_total > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>خصم كوبون:</span>
                    <span className="font-mono font-bold">-{formatCurrency(order.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black text-slate-900 border-t border-slate-200/60 pt-1">
                  <span>الإجمالي المطلوب:</span>
                  <span className="font-mono text-primary-700">{formatCurrency(order.total)}</span>
                </div>
              </div>

              {/* Info Badges (Branch & Mandob / Courier) */}
              <div className="space-y-1.5 pt-1 text-[11px] text-slate-500">
                <div className="flex items-center justify-between">
                  <span>فرع التجهيز: {order.branch?.name || 'غير محدد'}</span>
                  {order.mandob && <span className="font-bold text-indigo-700">المندوب: {order.mandob.name}</span>}
                </div>

                {/* Courier info if assigned */}
                {(order.shipping_type === 'COURIER' || order.status === 'SHIPPED_VIA_COURIER' || order.courier_name) && (
                  <div className="p-2.5 bg-purple-50/70 rounded-2xl border border-purple-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-purple-900 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-purple-600" />
                        {order.courier_name || 'شركة شحن خارجية'}
                      </span>
                      {order.tracking_number && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(order.tracking_number);
                            setCopiedTrackingId(order.id);
                            setTimeout(() => setCopiedTrackingId(null), 2000);
                          }}
                          className="flex items-center gap-1 text-[11px] font-mono text-purple-800 bg-white px-2 py-0.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition-all cursor-pointer shadow-2xs"
                          title="نسخ رقم البوليصة"
                        >
                          {copiedTrackingId === order.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-purple-500" />
                              <span className="font-bold">{order.tracking_number}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons based on Status */}
              <div className="pt-2 border-t border-slate-100">
                {!isMandob && order.status === 'PENDING_CONFIRMATION' && (
                  <button
                    onClick={() => {
                      setConfirmModalOrder(order);
                      setConfirmError(null);
                      setForceConfirm(false);
                      const defaultBranch = isManager
                        ? branches.find((b: any) => b.id === user?.branch_id)
                        : (branches.find((b: any) => b.id === order.branch_id) ||
                           branches.find((b: any) => b.is_main) ||
                           branches[0]);
                      setSelectedBranchId(defaultBranch?.id ?? (user?.branch_id ?? ''));
                    }}
                    className="w-full py-2.5 bg-primary-600 text-slate-950 rounded-xl text-xs font-black hover:bg-primary-500 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الطلب وتحديد المخزن</span>
                  </button>
                )}

                {!isMandob && order.status === 'CONFIRMED' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-bold">طريقة الشحن والتوصيل:</span>
                      {(() => {
                        const isLocal = /قاهرة|جيزة|cairo|giza/i.test(order.governorate || order.city || '');
                        return isLocal ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                            💡 مقترح: مندوب المتجر
                          </span>
                        ) : (
                          <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-md border border-purple-200">
                            💡 مقترح: شركة شحن
                          </span>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setDispatchModalOrder(order);
                          setSelectedMandobId(order.mandob_id || (mandobs[0]?.id ?? ''));
                        }}
                        className="py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>إسناد لمندوب</span>
                      </button>

                      <button
                        onClick={() => openCourierModal(order)}
                        className="py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black hover:bg-purple-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>إسناد لشركة شحن</span>
                      </button>
                    </div>
                  </div>
                )}

                {order.status === 'DISPATCHED' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openDeliverModal(order)}
                      className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{order.payment_status === 'PAID_ONLINE' ? 'تأكيد التسليم' : 'تسليم وتحصيل'}</span>
                    </button>
                    <button
                      onClick={() => returnMutation.mutate(order.id)}
                      disabled={returnMutation.isPending}
                      className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>مرتجع</span>
                    </button>
                  </div>
                )}

                {order.status === 'SHIPPED_VIA_COURIER' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openDeliverModal(order)}
                      className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{order.payment_status === 'PAID_ONLINE' ? 'تأكيد تسليم الشحنة' : 'تسليم وتحصيل COD'}</span>
                    </button>
                    <button
                      onClick={() => returnMutation.mutate(order.id)}
                      disabled={returnMutation.isPending}
                      className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>مرتجع شحن</span>
                    </button>
                  </div>
                )}

                {order.status === 'DELIVERED' && (
                  <div className="space-y-2">
                    <div className="text-center py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                      تم التسليم وإصدار الفاتورة بنجاح ✅
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrintOrder(order)}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>طباعة بوليصة التوصيل / الفاتورة</span>
                    </button>
                  </div>
                )}

                {order.status === 'RETURNED' && (
                  <div className="text-center py-1.5 text-xs font-bold text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
                    تم تسجيل الطلب كمرتجع ↩️
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </>
      )}

      {/* Modal 0: Order Details Modal (نافذة تفاصيل الأوردر الشاملة مع صور المنتجات والسمات) */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Mobile Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 font-mono">
                      طلب ووكومرس #{viewingOrder.wc_order_id}
                    </h2>
                    {getStatusBadge(viewingOrder.status)}
                  </div>
                  {(viewingOrder.order_date || viewingOrder.created_at) && (
                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>تاريخ الطلب: {formatOrderDate(viewingOrder)}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {viewingOrder.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    onClick={() => setPrintOrder(viewingOrder)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border border-slate-200/80"
                    title="طباعة بوليصة التوصيل / الفاتورة"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingOrder(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto py-3 space-y-3.5 pr-1 flex-1">
              {/* Customer Information Card */}
              {(() => {
                const phone = viewingOrder.customer_phone || viewingOrder.party?.phone;
                const address = viewingOrder.customer_address || viewingOrder.party?.address;
                const gov = viewingOrder.governorate || viewingOrder.city;
                const cleanPhoneForWa = phone ? phone.replace(/\D/g, '') : '';
                const waUrl = cleanPhoneForWa
                  ? (cleanPhoneForWa.startsWith('2') ? `https://wa.me/${cleanPhoneForWa}` : `https://wa.me/2${cleanPhoneForWa}`)
                  : null;

                return (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">بيانات العميل:</span>
                        <h3 className="text-sm font-black text-slate-900 mt-0.5">{viewingOrder.customer_name}</h3>
                      </div>

                      {/* Quick Contact Buttons (WhatsApp & Call) */}
                      <div className="flex items-center gap-2">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-mono">{phone}</span>
                          </a>
                        )}
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-emerald-600/20 active:scale-95"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                            </svg>
                            <span>محادثة واتساب</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Customer Address */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                      {gov && (
                        <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-bold text-slate-700">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{gov}</span>
                        </span>
                      )}
                      {address && (
                        <span className="font-medium text-slate-600">
                          {address}
                        </span>
                      )}
                    </div>

                    {/* Customer Note from WooCommerce */}
                    {viewingOrder.notes && (
                      <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 flex items-start gap-2">
                        <span className="font-bold shrink-0">ملاحظات العميل:</span>
                        <span className="leading-relaxed font-medium">{viewingOrder.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Products & Line Items with Images */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>الأصناف والمنتجات المطلوبة ({viewingOrder.items_snapshot?.length || 0})</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                  {(viewingOrder.items_snapshot || []).map((item: any, idx: number) => {
                    const qty = Math.max(1, Number(item.quantity) || 1);
                    const unitPrice = item.price || (item.subtotal ? item.subtotal / qty : 0);
                    const lineTotal = item.total || item.subtotal || (unitPrice * qty);

                    return (
                      <div key={idx} className="p-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                        {/* Thumbnail Image */}
                        <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={cleanItemName(item.name)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">
                            {cleanItemName(item.name)}
                          </h4>

                          {/* Variation Attributes */}
                          {item.attributes && Array.isArray(item.attributes) && item.attributes.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {item.attributes.map((attr: any, aIdx: number) => (
                                <span
                                  key={aIdx}
                                  className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                                >
                                  <span className="text-slate-400 ml-1">{attr.key}:</span>
                                  <span>{attr.value}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                            <span>سعر الوحدة: <strong className="text-slate-700">{formatCurrency(unitPrice)}</strong></span>
                            <span>الكمية: <strong className="text-slate-900">× {item.quantity}</strong></span>
                          </div>
                        </div>

                        {/* Line Total */}
                        <div className="text-left font-mono font-black text-xs text-slate-900 shrink-0">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>إجمالي المنتجات:</span>
                  <span className="font-mono font-bold">{formatCurrency(viewingOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>تكلفة الشحن والتوصيل:</span>
                  <span className="font-mono font-bold">{formatCurrency(viewingOrder.shipping_cost)}</span>
                </div>
                {viewingOrder.discount_total > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span className="flex items-center gap-1">
                      <span>خصم الكوبون:</span>
                      {viewingOrder.wc_coupon_codes && viewingOrder.wc_coupon_codes.length > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
                          {viewingOrder.wc_coupon_codes.join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold">-{formatCurrency(viewingOrder.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>الإجمالي النهائي المطلوب تحصيله:</span>
                  <span className="font-mono text-primary-700 text-base">{formatCurrency(viewingOrder.total)}</span>
                </div>
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold text-slate-700">
                    {viewingOrder.payment_status === 'PAID_ONLINE' ? '💳 مدفوع أونلاين' : '💵 الدفع عند الاستلام (COD)'}
                    {viewingOrder.wc_payment_method ? ` (${viewingOrder.wc_payment_method})` : ''}
                  </span>
                </div>
              </div>

              {/* Logistics & Assignment Card */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">فرع التجهيز والمخزون:</span>
                  <span className="font-bold text-slate-900">{viewingOrder.branch?.name || 'لم يحدد بعد'}</span>
                </div>
                {viewingOrder.mandob && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">المندوب المسند له:</span>
                    <span className="font-bold text-indigo-800">{viewingOrder.mandob.name}</span>
                  </div>
                )}
                {viewingOrder.courier_name && (
                  <div className="flex items-center justify-between border-t border-indigo-100/60 pt-1.5">
                    <span className="text-slate-600">شركة الشحن:</span>
                    <span className="font-bold text-purple-900">{viewingOrder.courier_name}</span>
                  </div>
                )}
                {viewingOrder.tracking_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">رقم البوليصة:</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {viewingOrder.tracking_number}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 shrink-0">
              {!isMandob && viewingOrder.status === 'PENDING_CONFIRMATION' && (
                <button
                  onClick={() => {
                    const order = viewingOrder;
                    setViewingOrder(null);
                    setConfirmModalOrder(order);
                    setConfirmError(null);
                    setForceConfirm(false);
                    const defaultBranch = isManager
                      ? branches.find((b: any) => b.id === user?.branch_id)
                      : (branches.find((b: any) => b.id === order.branch_id) ||
                         branches.find((b: any) => b.is_main) ||
                         branches[0]);
                    setSelectedBranchId(defaultBranch?.id ?? (user?.branch_id ?? ''));
                  }}
                  className="flex-1 py-2.5 bg-primary-600 text-slate-950 rounded-xl text-xs font-black hover:bg-primary-500 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد الطلب وتحديد المخزن</span>
                </button>
              )}

              {!isMandob && viewingOrder.status === 'CONFIRMED' && (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      setDispatchModalOrder(order);
                      setSelectedMandobId(order.mandob_id || (mandobs[0]?.id ?? ''));
                    }}
                    className="py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>إسناد لمندوب</span>
                  </button>
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      setCourierModalOrder(order);
                      setCourierBranchId(order.branch_id || branches[0]?.id || '');
                      setCourierTrackingNumber(order.tracking_number || '');
                      const found = couriers.find((c: any) => c.id === order.courier_party_id || c.name === order.courier_name);
                      setCourierPartyId(found?.id || order.courier_party_id || '');
                      setCourierName(found?.name || order.courier_name || '');
                    }}
                    className="py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black hover:bg-purple-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>إسناد لشركة شحن</span>
                  </button>
                </div>
              )}

              {viewingOrder.status === 'DISPATCHED' && (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      openDeliverModal(order);
                    }}
                    className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>{viewingOrder.payment_status === 'PAID_ONLINE' ? 'تأكيد التسليم' : 'تسليم وتحصيل'}</span>
                  </button>
                  <button
                    onClick={() => {
                      const orderId = viewingOrder.id;
                      setViewingOrder(null);
                      returnMutation.mutate(orderId);
                    }}
                    disabled={returnMutation.isPending}
                    className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>مرتجع</span>
                  </button>
                </div>
              )}

              {viewingOrder.status === 'SHIPPED_VIA_COURIER' && (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const order = viewingOrder;
                      setViewingOrder(null);
                      openDeliverModal(order);
                    }}
                    className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>{viewingOrder.payment_status === 'PAID_ONLINE' ? 'تأكيد تسليم الشحنة' : 'تسليم وتحصيل COD'}</span>
                  </button>
                  <button
                    onClick={() => {
                      const orderId = viewingOrder.id;
                      setViewingOrder(null);
                      returnMutation.mutate(orderId);
                    }}
                    disabled={returnMutation.isPending}
                    className="py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>مرتجع شحن</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Confirm Order Modal - Responsive Bottom Sheet */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                تأكيد الطلب #{confirmModalOrder.wc_order_id}
              </h3>
              <button
                onClick={() => setConfirmModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              اختر الفرع أو المخزن المسؤول عن تجهيز هذا الطلب. سيقوم النظام بالتحقق الآلي من توفر أرصدة المقاسات والألوان المطلوبة.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">فرع التجهيز والمخزون:</label>
              {isManager ? (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>تجهيز وسحب من فرعك: {branches.find((b: any) => b.id === (user?.branch_id ?? selectedBranchId))?.name || 'فرعك المعين'}</span>
                </div>
              ) : (
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {confirmError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>تنبيه المخزون بالفرع:</span>
                </div>
                <p className="whitespace-pre-line text-[11px] leading-relaxed font-medium text-rose-800">
                  {confirmError}
                </p>
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={forceConfirm}
                      onChange={(e) => setForceConfirm(e.target.checked)}
                      className="rounded border-rose-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-rose-950">
                      تأكيد الطلب استثنائياً واستلام البضاعة لاحقاً
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  confirmMutation.mutate({
                    orderId: confirmModalOrder.id,
                    branchId: Number(selectedBranchId),
                    force: forceConfirm,
                  })
                }
                disabled={confirmMutation.isPending || !selectedBranchId}
                className="flex-1 py-2.5 bg-primary-600 text-slate-950 font-black rounded-xl text-xs hover:bg-primary-500 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {confirmMutation.isPending
                  ? 'جاري الفحص والتأكيد...'
                  : forceConfirm
                  ? '⚠️ تأكيد استثنائي مع نقص المخزون'
                  : 'تأكيد وحجز المخزون'}
              </button>
              <button
                onClick={() => {
                  setConfirmModalOrder(null);
                  setConfirmError(null);
                  setForceConfirm(false);
                }}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Dispatch to Mandob Modal - Responsive Bottom Sheet */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                إسناد الطلب للمندوب #{dispatchModalOrder.wc_order_id}
              </h3>
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              اختر المندوب المكلف بالتسليم. سيتم تحويل بضاعة الطلب إلى عهدة سيارة المندوب (VAN) لضمان انضباط المخزون في الطريق.
            </p>

            {mandobs.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                <div className="text-xs font-bold text-amber-900">لا يوجد مناديب مسجلين حالياً في هذا الفرع</div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  يرجى إضافة مندوب جديد وتعيين دوره (مندوب توصيل) من صفحة الموظفين أولاً لتتمكن من إسناد الطلبات إليه.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    اختر مندوب التوصيل المكلف:
                  </label>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                    {mandobs.length} {mandobs.length === 1 ? 'مندوب متاح' : 'مناديب متاحين'}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5" style={{ touchAction: 'pan-y' }}>
                  {mandobs.map((m: any) => {
                    const isSelected = Number(selectedMandobId) === Number(m.id);
                    return (
                      <div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          selection();
                          setSelectedMandobId(m.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            selection();
                            setSelectedMandobId(m.id);
                          }
                        }}
                        className={`w-full p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer select-none active:scale-[0.99] ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-black text-xs text-slate-900">{m.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                              <span>{m.phone || 'بدون رقم هاتف'}</span>
                              {m.branch?.name && (
                                <span className="text-[10px] text-slate-400 font-sans">
                                  • {m.branch.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 mr-2">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  dispatchMutation.mutate({
                    orderId: dispatchModalOrder.id,
                    mandobId: Number(selectedMandobId),
                  })
                }
                disabled={dispatchMutation.isPending || !selectedMandobId}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-xs hover:bg-indigo-700 shadow-xs"
              >
                {dispatchMutation.isPending ? 'جاري التحويل والشحن...' : 'تأكيد الشحن مع المندوب'}
              </button>
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Deliver & Collect Modal - Responsive Bottom Sheet */}
      {deliverModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                تسليم وتحصيل الطلب #{deliverModalOrder.wc_order_id}
              </h3>
              <button
                onClick={() => setDeliverModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deliverModalOrder.courier_party_id ? (
              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200 text-xs text-sky-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>شركة الشحن: {deliverModalOrder.courier_name || 'شركة شحن خارجية'}</span>
                </div>
                <p className="text-[11px] text-sky-700">
                  {deliverModalOrder.payment_status === 'PAID_ONLINE' || (deliverModalOrder.wc_payment_method && deliverModalOrder.wc_payment_method !== 'cod')
                    ? 'الطلب مسدد أونلاين مسبقاً، ومهمة شركة الشحن هي التوصيل فقط (المطلوب تحصيله 0 ج.م).'
                    : 'المبلغ المحصل سيُقيد كعهدة معلقة في كشف حساب شركة الشحن، ولن يدخل الخزينة إلا عند توريد الكاش بسند قبض.'}
                </p>
              </div>
            ) : (deliverModalOrder.payment_status === 'PAID_ONLINE' || (deliverModalOrder.wc_payment_method && deliverModalOrder.wc_payment_method !== 'cod')) ? (
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>✓</span>
                  <span>الطلب مسدد مسبقاً بالكامل عبر المتجر أونلاين</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  المبلغ المطلوب تحصيله نقداً هو 0.00 ج.م، وستصدر الفاتورة مسددة إلكترونياً دون تحميل عهدة المندوب أي نقدية.
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المحصل فعلياً (ج.م):</label>
                <input
                  type="number"
                  step="0.01"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع والتحصيل:</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {deliverModalOrder.courier_party_id && (
                    <option value="COURIER_COD">تحصيل عبر شركة شحن (COD)</option>
                  )}
                  <option value="CASH">نقدية كاش (COD)</option>
                  <option value="CARD">بطاقة بنكية / فيزا</option>
                  <option value="INSTAPAY">تحويل إنستاباي (InstaPay)</option>
                  <option value="VODAFONE_CASH">محفظة إلكترونية / فودافون كاش</option>
                  <option value="TRANSFER">تحويل بنكي آخر</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  deliverMutation.mutate({
                    orderId: deliverModalOrder.id,
                    amount: collectedAmount,
                    method: paymentMethod,
                  })
                }
                disabled={deliverMutation.isPending}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-black rounded-xl text-xs hover:bg-emerald-700 shadow-xs"
              >
                {deliverMutation.isPending ? 'جاري إصدار الفاتورة...' : 'إصدار الفاتورة وتأكيد التسليم'}
              </button>
              <button
                onClick={() => setDeliverModalOrder(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Dispatch to Courier Modal - Responsive Bottom Sheet */}
      {courierModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                <span>إسناد الطلب لشركة شحن #{courierModalOrder.wc_order_id}</span>
              </h3>
              <button
                onClick={() => setCourierModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              إسناد شحنة المتجر لشركة شحن خارجية (مثل بوسطة، أرامكس، مايلرز). يتم حجز رصيد البضاعة من المخزن المحدد وتوثيق رقم البوليصة لمتابعة التسليم وتصفية الكاش.
            </p>

            <div className="space-y-4">
              {/* Registered Courier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    شركة الشحن المسجلة بالدفاتر <span className="text-red-500">*</span>
                  </label>
                  {!showAddCourier && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCourier(true);
                        setNewCourierName('');
                        setNewCourierPhone('');
                        setNewCourierNotes('');
                        setAddCourierError(null);
                      }}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة شركة جديدة</span>
                    </button>
                  )}
                </div>

                {showAddCourier ? (
                  <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-purple-600" />
                        إضافة شركة شحن جديدة للدفاتر (بوسطة / أرامكس / مايلرز)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddCourier(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم شركة الشحن *</label>
                        <input
                          type="text"
                          value={newCourierName}
                          onChange={(e) => setNewCourierName(e.target.value)}
                          placeholder="مثال: بوسطة (Bosta) / أرامكس"
                          className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:border-purple-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم الهاتف للتواصل</label>
                        <input
                          type="text"
                          value={newCourierPhone}
                          onChange={(e) => setNewCourierPhone(e.target.value)}
                          placeholder="مثال: 01012345678"
                          className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات الحساب (اختياري)</label>
                      <input
                        type="text"
                        value={newCourierNotes}
                        onChange={(e) => setNewCourierNotes(e.target.value)}
                        placeholder="مثال: تحصيل أسبوعي / تغطية كافة المحافظات"
                        className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    {addCourierError && (
                      <p className="text-[11px] font-bold text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-200">{addCourierError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddCourier(false)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        disabled={createCourierMutation.isPending || !newCourierName.trim()}
                        onClick={handleCreateCourier}
                        className="px-3.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                      >
                        {createCourierMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>حفظ واختيار الشركة</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <select
                      value={courierPartyId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setCourierPartyId(val);
                        if (val) {
                          const found = couriers.find((c: any) => c.id === val);
                          if (found) setCourierName(found.name);
                        } else {
                          setCourierName('');
                        }
                      }}
                      className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold transition-all ${
                        !courierPartyId ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 focus:border-purple-500'
                      }`}
                    >
                      <option value="">-- اختر شركة الشحن المسجلة بالدفاتر * --</option>
                      {couriers.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>

                    {couriers.length === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl mt-2 font-bold leading-relaxed">
                        ⚠️ لا توجد شركات شحن مسجلة بالدفاتر حالياً. يرجى الضغط على <strong>"+ إضافة شركة جديدة"</strong> أعلاه لتسجيل شركة الشحن (مثل بوسطة أو أرامكس) لضمان توثيق كشف الحساب والمديونية المحاسبية.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Tracking Number / AWB */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم بوليصة الشحن (Tracking Number / AWB):
                </label>
                <input
                  type="text"
                  value={courierTrackingNumber}
                  onChange={(e) => setCourierTrackingNumber(e.target.value)}
                  placeholder="رقم البوليصة إن وُجد (اختياري)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              {/* Source Branch */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مخزن خروج الشحنة:</label>
                <select
                  value={courierBranchId}
                  onChange={(e) => setCourierBranchId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  if (!courierPartyId) {
                    setFeedback({ type: 'error', message: 'يرجى اختيار شركة شحن مسجلة بالدفاتر أولاً لإسناد الشحنة' });
                    return;
                  }
                  courierDispatchMutation.mutate({
                    orderId: courierModalOrder.id,
                    courierName,
                    courierPartyId: Number(courierPartyId),
                    trackingNumber: courierTrackingNumber || undefined,
                    branchId: courierBranchId ? Number(courierBranchId) : undefined,
                  });
                }}
                disabled={courierDispatchMutation.isPending || !courierPartyId}
                className="flex-1 py-2.5 bg-purple-600 text-white font-black rounded-xl text-xs hover:bg-purple-700 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {courierDispatchMutation.isPending ? 'جاري الإسناد والتحديث...' : 'تأكيد الإسناد لشركة الشحن'}
              </button>
              <button
                onClick={() => setCourierModalOrder(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal POS Receipt Modal for WooCommerce Order Invoices */}
      {printOrder && (
        <PosReceiptModal
          isOpen={Boolean(printOrder)}
          onClose={() => setPrintOrder(null)}
          invoice={
            printOrder.invoice
              ? {
                  ...printOrder.invoice,
                  party: printOrder.party || {
                    name: printOrder.customer_name,
                    phone: printOrder.customer_phone,
                    address: printOrder.customer_address,
                  },
                  customer_phone: printOrder.customer_phone || printOrder.party?.phone,
                  customer_address: [
                    printOrder.customer_address || printOrder.party?.address,
                    printOrder.city,
                    printOrder.governorate,
                  ]
                    .filter(Boolean)
                    .join(' - '),
                  items: printOrder.invoice.items?.length
                    ? printOrder.invoice.items
                    : (printOrder.items_snapshot || []).map((i: any) => ({
                        product_name: cleanItemName(i.name),
                        unit_price: i.price || (i.total && i.quantity ? Number(i.total) / Number(i.quantity) : 0),
                        quantity: i.quantity,
                        total: i.total || Number(i.price || 0) * Number(i.quantity || 1),
                      })),
                  courier_name: printOrder.courier_name,
                  tracking_number: printOrder.tracking_number,
                }
              : {
                  id: printOrder.id,
                  invoice_number: `WC-${printOrder.wc_order_id}`,
                  date: (printOrder.order_date || printOrder.created_at || '').split('T')[0],
                  created_at: printOrder.order_date || printOrder.created_at,
                  party: printOrder.party || {
                    name: printOrder.customer_name,
                    phone: printOrder.customer_phone,
                    address: printOrder.customer_address,
                  },
                  customer_phone: printOrder.customer_phone || printOrder.party?.phone,
                  customer_address: [
                    printOrder.customer_address || printOrder.party?.address,
                    printOrder.city,
                    printOrder.governorate,
                  ]
                    .filter(Boolean)
                    .join(' - '),
                  party_name: printOrder.customer_name,
                  items: (printOrder.items_snapshot || []).map((i: any) => ({
                    product_name: cleanItemName(i.name),
                    unit_price: i.price || (i.total && i.quantity ? Number(i.total) / Number(i.quantity) : 0),
                    quantity: i.quantity,
                    total: i.total || Number(i.price || 0) * Number(i.quantity || 1),
                  })),
                  subtotal:
                    Number(printOrder.total) -
                    Number(printOrder.shipping_cost || 0) +
                    Number(printOrder.discount_total || 0),
                  discount: printOrder.discount_total,
                  shipping_amount: printOrder.shipping_cost,
                  total: printOrder.total,
                  paid_amount:
                    printOrder.payment_status === 'PAID_ONLINE' ||
                    (printOrder.wc_payment_method && printOrder.wc_payment_method !== 'cod')
                      ? printOrder.total
                      : 0,
                  payment_method:
                    printOrder.payment_status === 'PAID_ONLINE' ||
                    (printOrder.wc_payment_method && printOrder.wc_payment_method !== 'cod')
                      ? 'CARD'
                      : printOrder.courier_party_id
                        ? 'COURIER_COD'
                        : 'CASH',
                  courier_name: printOrder.courier_name,
                  tracking_number: printOrder.tracking_number,
                }
          }
        />
      )}
    </div>
  );
};
