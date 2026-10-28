import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';
import { usePermissions } from './usePermissions';
import { useAuthStore } from '../data/store/useAuthStore';
import { calculatePresetDates } from '../presentation/components/common/DateRangeFilter';
import { nativeBackButton } from '../platform/nativeBackButton';
import { useHaptic } from '../presentation/hooks/useHaptic';

export function useWcOrders() {
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
  useEffect(() => {
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
  return {
    selection,
    canPullOrders,
    isOwnerOrAdmin,
    isManager,
    isMandob,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    viewingOrder,
    setViewingOrder,
    confirmModalOrder,
    setConfirmModalOrder,
    selectedBranchId,
    setSelectedBranchId,
    confirmError,
    setConfirmError,
    forceConfirm,
    setForceConfirm,
    dispatchModalOrder,
    setDispatchModalOrder,
    selectedMandobId,
    setSelectedMandobId,
    courierModalOrder,
    setCourierModalOrder,
    courierName,
    setCourierName,
    courierPartyId,
    setCourierPartyId,
    courierTrackingNumber,
    setCourierTrackingNumber,
    courierBranchId,
    setCourierBranchId,
    copiedTrackingId,
    setCopiedTrackingId,
    showAddCourier,
    setShowAddCourier,
    newCourierName,
    setNewCourierName,
    newCourierPhone,
    setNewCourierPhone,
    newCourierNotes,
    setNewCourierNotes,
    addCourierError,
    setAddCourierError,
    deliverModalOrder,
    setDeliverModalOrder,
    collectedAmount,
    setCollectedAmount,
    paymentMethod,
    setPaymentMethod,
    openDeliverModal,
    printOrder,
    setPrintOrder,
    feedback,
    setFeedback,
    user,
    branches,
    mandobs,
    couriers,
    openCourierModal,
    orders,
    isLoading,
    confirmMutation,
    dispatchMutation,
    courierDispatchMutation,
    handleCreateCourier,
    createCourierMutation,
    deliverMutation,
    returnMutation,
    pullMutation,
  };
}
