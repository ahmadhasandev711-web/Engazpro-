import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EcommercePlatform, OnlineOrderCallStatus, OrderCancelReason } from '@pos-mandob/shared';
import { apiClient } from '../data/api/client';
import { REFERENCE_QUERY_OPTIONS } from '../data/api/queryPresets';
import { useDebouncedValue } from './useDebouncedValue';
import { usePermissions } from './usePermissions';
import { useBranchScope } from './useBranchScope';
import { useAuthStore } from '../data/store/useAuthStore';
import { calculatePresetDates } from '../presentation/components/common/DateRangeFilter';
import { nativeBackButton } from '../platform/nativeBackButton';
import { useHaptic } from '../presentation/hooks/useHaptic';
import { getOrderDisplayRef, isOrderPrepaid } from '../presentation/components/wc-orders/helpers';

export interface OrdersChannelConfig {
  apiBase?: string;
  queryKey?: string;
  channelTitle?: string;
}

export function useOnlineOrders(config?: OrdersChannelConfig) {
  const { isOwnerOrAdmin, isManager, isMandob, activeEcommercePlatform } = usePermissions();
  const apiBase = config?.apiBase ?? '/online-orders';
  const orderQueryKey = config?.queryKey ?? 'online-orders';
  const platformTitle =
    activeEcommercePlatform === EcommercePlatform.SHOPIFY
      ? 'Shopify'
      : activeEcommercePlatform === EcommercePlatform.WOOCOMMERCE
        ? 'WooCommerce'
        : 'المتجر';
  const channelTitle = config?.channelTitle ?? `طلبات ${platformTitle} والتوصيل الميداني`;

  const queryClient = useQueryClient();
  const { selection } = useHaptic();
  const canPullOrders = isOwnerOrAdmin || isManager;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(() => calculatePresetDates('today').from);
  const [toDate, setToDate] = useState<string>(() => calculatePresetDates('today').to);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  const [confirmModalOrder, setConfirmModalOrder] = useState<any | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [forceConfirm, setForceConfirm] = useState<boolean>(false);

  const [dispatchModalOrder, setDispatchModalOrder] = useState<any | null>(null);
  const [selectedMandobId, setSelectedMandobId] = useState<number | ''>('');

  const [courierModalOrder, setCourierModalOrder] = useState<any | null>(null);
  const [courierName, setCourierName] = useState<string>('');
  const [courierPartyId, setCourierPartyId] = useState<number | ''>('');
  const [courierTrackingNumber, setCourierTrackingNumber] = useState<string>('');
  const [courierBranchId, setCourierBranchId] = useState<number | ''>('');
  const [copiedTrackingId, setCopiedTrackingId] = useState<number | null>(null);

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
    const prepaid = isOrderPrepaid(order);
    setCollectedAmount(prepaid ? 0 : Number(order.total || 0));
    if (prepaid) {
      setPaymentMethod('CARD');
    } else if (order.courier_party_id) {
      setPaymentMethod('COURIER_COD');
    } else {
      setPaymentMethod('CASH');
    }
  };

  const [printOrder, setPrintOrder] = useState<any | null>(null);
  const [callModalOrder, setCallModalOrder] = useState<any | null>(null);
  const [callOutcome, setCallOutcome] = useState<OnlineOrderCallStatus>(OnlineOrderCallStatus.NO_ANSWER);
  const [callScheduledAt, setCallScheduledAt] = useState<string>('');
  const [callNotes, setCallNotes] = useState<string>('');
  const [cancelModalOrder, setCancelModalOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<OrderCancelReason>(OrderCancelReason.CUSTOMER_REJECTED);
  const [cancelNotes, setCancelNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const openCallModal = (order: any, outcome: OnlineOrderCallStatus = OnlineOrderCallStatus.CALLBACK_SCHEDULED) => {
    setCallModalOrder(order);
    setCallOutcome(outcome);
    if (order?.call_scheduled_at) {
      const d = new Date(order.call_scheduled_at);
      const localIso = !Number.isNaN(d.getTime())
        ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : '';
      setCallScheduledAt(localIso);
    } else {
      const defaultDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      setCallScheduledAt(new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
    setCallNotes(order?.call_notes || '');
  };

  const openCancelModal = (order: any) => {
    setCancelModalOrder(order);
    setCancelReason(OrderCancelReason.CUSTOMER_REJECTED);
    setCancelNotes('');
  };

  useEffect(() => {
    const isAnyModalOpen =
      Boolean(viewingOrder) ||
      Boolean(confirmModalOrder) ||
      Boolean(courierModalOrder) ||
      Boolean(dispatchModalOrder) ||
      Boolean(deliverModalOrder) ||
      Boolean(callModalOrder) ||
      Boolean(cancelModalOrder) ||
      Boolean(printOrder);

    if (!isAnyModalOpen) return;

    const unregister = nativeBackButton.register(() => {
      if (printOrder) { setPrintOrder(null); return true; }
      if (cancelModalOrder) { setCancelModalOrder(null); return true; }
      if (callModalOrder) { setCallModalOrder(null); return true; }
      if (deliverModalOrder) { setDeliverModalOrder(null); return true; }
      if (courierModalOrder) { setCourierModalOrder(null); return true; }
      if (dispatchModalOrder) { setDispatchModalOrder(null); return true; }
      if (confirmModalOrder) { setConfirmModalOrder(null); return true; }
      if (viewingOrder) { setViewingOrder(null); return true; }
      return false;
    });

    return () => { unregister(); };
  }, [viewingOrder, confirmModalOrder, courierModalOrder, dispatchModalOrder, deliverModalOrder, callModalOrder, cancelModalOrder, printOrder]);

  const user = useAuthStore((state) => state.user);
  const { hasGlobalBranchAccess, lockedBranchId, canAccessBranchId } = useBranchScope();

  useEffect(() => {
    if (!hasGlobalBranchAccess && lockedBranchId) {
      if (selectedBranchId !== lockedBranchId) {
        setSelectedBranchId(lockedBranchId);
      }
      if (courierBranchId !== lockedBranchId) {
        setCourierBranchId(lockedBranchId);
      }
    }
  }, [hasGlobalBranchAccess, lockedBranchId, selectedBranchId, courierBranchId]);

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
    ...REFERENCE_QUERY_OPTIONS,
  });
  const branches = Array.isArray(branchesData) ? branchesData : [];

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
    enabled: !isMandob,
    ...REFERENCE_QUERY_OPTIONS,
  });
  const employees = Array.isArray(employeesData) ? employeesData : [];
  const mandobs = employees.filter((e: any) => {
    const isMandobRole = e.role === 'MANDOB' || e.role === 'MANAGER';
    if (!hasGlobalBranchAccess) {
      return isMandobRole && (canAccessBranchId(e.branch_id) || e.branch_type === 'VAN');
    }
    return isMandobRole;
  });

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
    enabled: !isMandob,
    ...REFERENCE_QUERY_OPTIONS,
  });
  const couriers = Array.isArray(couriersData) ? couriersData : [];

  const openCourierModal = (order: any) => {
    setCourierModalOrder(order);
    const matchedParty = couriers.find((c: any) => c.id === order.courier_party_id || c.name === order.courier_name);
    setCourierPartyId(matchedParty?.id || order.courier_party_id || '');
    setCourierName(matchedParty?.name || order.courier_name || '');
    setCourierTrackingNumber(order.tracking_number || '');
    const mainBranch = branches.find((b: any) => b.is_main) || branches[0];
    setCourierBranchId((!hasGlobalBranchAccess && lockedBranchId) ? lockedBranchId : (order.branch_id || (mainBranch?.id ?? '')));
    setShowAddCourier(false);
    setNewCourierName('');
    setNewCourierPhone('');
    setNewCourierNotes('');
    setAddCourierError(null);
  };

  const { data: ordersResult, isLoading } = useQuery({
    queryKey: [orderQueryKey, activeEcommercePlatform, debouncedSearch, statusFilter, fromDate, toDate],
    queryFn: async () => {
      const params: any = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (fromDate) params.date_from = fromDate;
      if (toDate) params.date_to = toDate;

      const res = await apiClient.get(apiBase, { params });
      const raw = res.data?.data?.data ?? res.data?.data ?? res.data;
      const items = Array.isArray(raw)
        ? raw.map((o: any) => ({
            ...o,
            display_reference: getOrderDisplayRef(o),
            coupon_codes: o.coupon_codes ?? o.wc_coupon_codes ?? [],
            payment_method_label: o.payment_method_label ?? o.wc_payment_method ?? null,
          }))
        : [];
      const counts: Record<string, number> | null = res.data?.counts ?? null;
      return { items, counts };
    },
    placeholderData: (previousData) => previousData,
  });
  const orders = ordersResult?.items ?? [];
  const statusCounts = ordersResult?.counts ?? null;

  const confirmMutation = useMutation({
    mutationFn: async ({ orderId, branchId, force }: { orderId: number; branchId: number; force?: boolean }) =>
      apiClient.post(`${apiBase}/${orderId}/confirm`, { branch_id: branchId, force: force || false }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
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

  const dispatchMutation = useMutation({
    mutationFn: async ({ orderId, mandobId }: { orderId: number; mandobId: number }) =>
      apiClient.post(`${apiBase}/${orderId}/dispatch`, { mandob_id: mandobId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
      setDispatchModalOrder(null);
      setFeedback({ type: 'success', message: res.data?.message || 'تم إسناد الطلب للمندوب' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل إسناد الطلب' });
    },
  });

  const courierDispatchMutation = useMutation({
    mutationFn: async ({
      orderId, courierName, courierPartyId, trackingNumber, branchId,
    }: {
      orderId: number; courierName: string; courierPartyId?: number | null; trackingNumber?: string | null; branchId?: number | null;
    }) => apiClient.post(`${apiBase}/${orderId}/dispatch-courier`, {
      courier_name: courierName,
      courier_party_id: courierPartyId || undefined,
      tracking_number: trackingNumber || undefined,
      branch_id: branchId || undefined,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
      setCourierModalOrder(null);
      setFeedback({ type: 'success', message: res.data?.message || 'تم إسناد الطلب لشركة الشحن بنجاح' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل إسناد الطلب لشركة الشحن' });
    },
  });

  const createCourierMutation = useMutation({
    mutationFn: async (payload: { name: string; phone?: string; notes?: string }) =>
      apiClient.post('/parties', { ...payload, type: 'COURIER' }),
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

  const deliverMutation = useMutation({
    mutationFn: async ({ orderId, amount, method }: { orderId: number; amount: number; method: string }) =>
      apiClient.post(`${apiBase}/${orderId}/deliver`, { collected_amount: amount, payment_method: method }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
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

  const returnMutation = useMutation({
    mutationFn: async (orderId: number) =>
      apiClient.post(`${apiBase}/${orderId}/return`, { reason: 'رفض العميل الاستلام' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
      setFeedback({ type: 'success', message: 'تم تسجيل الطلب كمرتجع' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل تسجيل المرتجع' });
    },
  });

  const logCallMutation = useMutation({
    mutationFn: async ({
      orderId, callStatus, scheduledAt, notes,
    }: {
      orderId: number; callStatus: OnlineOrderCallStatus; scheduledAt?: string; notes?: string;
    }) =>
      apiClient.post(`${apiBase}/${orderId}/log-call`, {
        call_status: callStatus,
        call_scheduled_at: callStatus === OnlineOrderCallStatus.CALLBACK_SCHEDULED ? (scheduledAt || undefined) : undefined,
        call_notes: notes || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
      const updated = res.data?.data;
      if (updated?.id) {
        setViewingOrder((prev: any) => (prev?.id === updated.id ? { ...updated, display_reference: getOrderDisplayRef(updated) } : prev));
      }
      setCallModalOrder(null);
      setFeedback({ type: 'success', message: res.data?.message || 'تم تسجيل محاولة الاتصال' });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل تسجيل محاولة الاتصال' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ orderId, reason, notes }: { orderId: number; reason: OrderCancelReason; notes?: string }) =>
      apiClient.post(`${apiBase}/${orderId}/cancel`, { reason, notes: notes || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
      const updated = res.data?.data;
      if (updated?.id) {
        setViewingOrder((prev: any) => (prev?.id === updated.id ? { ...updated, display_reference: getOrderDisplayRef(updated) } : prev));
      }
      setCancelModalOrder(null);
      setFeedback({ type: 'success', message: res.data?.message || 'تم إلغاء الطلب وتحديث المتجر بنجاح' });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل إلغاء الطلب' });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async () => apiClient.post(`${apiBase}/pull`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [orderQueryKey] });
      setFeedback({ type: 'success', message: res.data?.message || 'جاري سحب وتحديث الطلبات في الخلفية ⏳' });
      setTimeout(() => { queryClient.invalidateQueries({ queryKey: [orderQueryKey] }); }, 10000);
      setTimeout(() => setFeedback(null), 6000);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'فشل سحب الطلبات من المتجر' });
    },
  });

  return {
    channelTitle, selection, canPullOrders, isOwnerOrAdmin, isManager, isMandob,
    search, setSearch, statusFilter, setStatusFilter, fromDate, setFromDate, toDate, setToDate,
    viewingOrder, setViewingOrder, confirmModalOrder, setConfirmModalOrder,
    selectedBranchId, setSelectedBranchId, confirmError, setConfirmError, forceConfirm, setForceConfirm,
    dispatchModalOrder, setDispatchModalOrder, selectedMandobId, setSelectedMandobId,
    courierModalOrder, setCourierModalOrder, courierName, setCourierName, courierPartyId, setCourierPartyId,
    courierTrackingNumber, setCourierTrackingNumber, courierBranchId, setCourierBranchId,
    copiedTrackingId, setCopiedTrackingId, showAddCourier, setShowAddCourier,
    newCourierName, setNewCourierName, newCourierPhone, setNewCourierPhone,
    newCourierNotes, setNewCourierNotes, addCourierError, setAddCourierError,
    deliverModalOrder, setDeliverModalOrder, collectedAmount, setCollectedAmount,
    paymentMethod, setPaymentMethod, openDeliverModal, printOrder, setPrintOrder,
    callModalOrder, setCallModalOrder, callOutcome, setCallOutcome,
    callScheduledAt, setCallScheduledAt, callNotes, setCallNotes, openCallModal, logCallMutation,
    cancelModalOrder, setCancelModalOrder, cancelReason, setCancelReason,
    cancelNotes, setCancelNotes, openCancelModal, cancelMutation,
    feedback, setFeedback, user, branches, mandobs, couriers, openCourierModal,
    orders, statusCounts, isLoading, confirmMutation, dispatchMutation, courierDispatchMutation,
    handleCreateCourier, createCourierMutation, deliverMutation, returnMutation, pullMutation,
  };
}
