import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Wallet, RefreshCw } from 'lucide-react';
import { TreasuryType, Money } from '@pos-mandob/shared';
import { apiClient } from '../data/api/client';
import { usePermissions } from './usePermissions';
import { FilterChipOption } from '../presentation/components/mobile/MobileFilterChips';
import { ShiftZReportData } from '../presentation/components/shifts/ShiftZReportModal';
import { calculatePresetDates } from '../presentation/components/common/DateRangeFilter';
import { nativeBackButton } from '../platform/nativeBackButton';

export function useTreasuriesPage() {
  const queryClient = useQueryClient();
  const {
    canSettleShifts,
    canManageTreasury,
    canManageBanks,
    canCreateTreasury,
    canViewAllTreasuries,
  } = usePermissions();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'TREASURIES' | 'ALL_SHIFTS'>('PENDING');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [selectedShiftToSettle, setSelectedShiftToSettle] = useState<any | null>(null);
  const [selectedPrintShift, setSelectedPrintShift] = useState<ShiftZReportData | null>(null);

  // Shifts history date filter & pagination state (defaults to today)
  const initialShiftDates = useMemo(() => calculatePresetDates('today'), []);
  const [shiftDateFrom, setShiftDateFrom] = useState<string>(initialShiftDates.from);
  const [shiftDateTo, setShiftDateTo] = useState<string>(initialShiftDates.to);
  const [shiftPage, setShiftPage] = useState<number>(1);

  const handleShiftDateChange = (from: string, to: string) => {
    setShiftDateFrom(from);
    setShiftDateTo(to);
    setShiftPage(1);
  };

  // Modals
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [transferData, setTransferData] = useState({
    from_treasury_id: '',
    to_treasury_id: '',
    amount: '',
    notes: '',
  });

  const [createData, setCreateData] = useState({
    name: '',
    type: 'BANK',
    branch_id: '',
    opening_balance: '0',
    notes: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch Branches for filter and creation dropdowns
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
    enabled: canViewAllTreasuries,
  });
  const branches: any[] = Array.isArray(branchesData) ? branchesData : ((branchesData as any)?.data || []);

  // Fetch Treasuries Query
  const { data: treasuriesData } = useQuery({
    queryKey: ['treasuries', selectedBranchId],
    queryFn: async () => {
      const params: any = {};
      if (selectedBranchId) params.branch_id = selectedBranchId;
      const res = await apiClient.get('/treasuries', { params });
      return res.data?.data || [];
    },
  });

  // Fetch Transfer Destination Treasuries (Includes Bank & Main Safe for remittance/توريد)
  const { data: transferDestinationsData } = useQuery({
    queryKey: ['treasuries', 'transfer-destinations'],
    queryFn: async () => {
      const res = await apiClient.get('/treasuries', { params: { for_transfer: true } });
      return res.data?.data || [];
    },
    enabled: transferModalOpen,
  });
  const transferDestinations: any[] = transferDestinationsData || treasuriesData || [];

  // Fetch Pending Closed Shifts
  const { data: pendingShiftsData, isLoading: isPendingLoading } = useQuery({
    queryKey: ['shifts', 'CLOSED', selectedBranchId],
    queryFn: async () => {
      const params: any = { status: 'CLOSED' };
      if (selectedBranchId) params.branch_id = selectedBranchId;
      const res = await apiClient.get('/shifts', { params });
      return res.data?.data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch All Shifts History with date range and pagination
  const { data: allShiftsResponse, isLoading: isAllShiftsLoading } = useQuery({
    queryKey: ['shifts', 'ALL', selectedBranchId, shiftDateFrom, shiftDateTo, shiftPage],
    queryFn: async () => {
      const params: any = {
        page: shiftPage,
        per_page: 20,
      };
      if (selectedBranchId) params.branch_id = selectedBranchId;
      if (shiftDateFrom) params.date_from = shiftDateFrom;
      if (shiftDateTo) params.date_to = shiftDateTo;
      const res = await apiClient.get('/shifts', { params });
      return res.data;
    },
    enabled: activeTab === 'ALL_SHIFTS',
  });

  // Create Treasury Mutation
  const createTreasuryMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: createData.name.trim(),
        type: createData.type,
        opening_balance: Number(createData.opening_balance) || 0,
        notes: createData.notes ? createData.notes.trim() : undefined,
      };
      if (createData.branch_id) {
        payload.branch_id = Number(createData.branch_id);
      }
      const res = await apiClient.post('/treasuries', payload);
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      setCreateModalOpen(false);
      setCreateData({ name: '', type: 'BANK', branch_id: '', opening_balance: '0', notes: '' });
      setMessage({ type: 'success', text: res.message || 'تم إنشاء الخزينة / الحساب بنجاح' });
      setTimeout(() => setMessage(null), 6000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'تعذر إنشاء الخزينة' });
      setTimeout(() => setMessage(null), 6000);
    },
  });

  // Settle Shift Mutation
  const settleMutation = useMutation({
    mutationFn: async ({ shiftId, notes }: { shiftId: number; notes: string }) => {
      const res = await apiClient.post(`/shifts/${shiftId}/settle`, {
        settlement_notes: notes || undefined,
      });
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      setSelectedShiftToSettle(null);
      setSettlementNotes('');
      setMessage({ type: 'success', text: res.message || 'تم تأكيد الاستلام وتوريد النقدية بنجاح' });
      setTimeout(() => setMessage(null), 6000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'تعذر اعتماد الوردية' });
      setTimeout(() => setMessage(null), 6000);
    },
  });

  // Transfer Mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/treasuries/transfer', {
        from_treasury_id: Number(transferData.from_treasury_id),
        to_treasury_id: Number(transferData.to_treasury_id),
        amount: Number(transferData.amount),
        notes: transferData.notes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasuries'] });
      setTransferModalOpen(false);
      setTransferData({ from_treasury_id: '', to_treasury_id: '', amount: '', notes: '' });
      setMessage({ type: 'success', text: 'تم إجراء التحويل المالي بين الخزن والحسابات بنجاح' });
      setTimeout(() => setMessage(null), 6000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'تعذر إجراء التحويل' });
      setTimeout(() => setMessage(null), 6000);
    },
  });

  const treasuries: any[] = treasuriesData || [];
  const pendingShifts: any[] = pendingShiftsData || [];
  const allShifts: any[] = allShiftsResponse?.data || [];
  const shiftMeta = allShiftsResponse?.meta;
  const currentShiftPage = shiftMeta?.current_page || shiftPage;
  const lastShiftPage = shiftMeta?.last_page || 1;
  const totalShiftsCount = shiftMeta?.total ?? allShifts.length;

  // Grouped treasuries
  const mainTreasuries = treasuries.filter((t) => t.type === TreasuryType.MAIN);
  const branchSafes = treasuries.filter((t) => t.type === TreasuryType.BRANCH_SAFE);
  const safes = treasuries.filter((t) => t.type === TreasuryType.MAIN || t.type === TreasuryType.BRANCH_SAFE);
  const banksAndWallets = treasuries.filter((t) => t.type === TreasuryType.BANK || t.type === TreasuryType.WALLET);
  const ownerDrawings = treasuries.filter((t) => t.type === TreasuryType.OWNER_DRAWINGS);
  const drawersAndCustodies = treasuries.filter(
    (t) => t.type === TreasuryType.CASHIER_DRAWER || t.type === TreasuryType.MANDOB_CUSTODY
  );

  const mainTotal = mainTreasuries.reduce((acc, t) => acc.add(t.current_balance ?? t.balance ?? 0), Money.zero()).getAmount();
  const branchSafesTotal = branchSafes.reduce((acc, t) => acc.add(t.current_balance ?? t.balance ?? 0), Money.zero()).getAmount();
  const safesTotal = safes.reduce((acc, t) => acc.add(t.current_balance ?? t.balance ?? 0), Money.zero()).getAmount();
  const banksAndWalletsTotal = banksAndWallets.reduce((acc, t) => acc.add(t.current_balance ?? t.balance ?? 0), Money.zero()).getAmount();
  const ownerDrawingsTotal = ownerDrawings.reduce((acc, t) => acc.add(t.current_balance ?? t.balance ?? 0), Money.zero()).getAmount();
  const drawersAndCustodiesTotal = drawersAndCustodies.reduce((acc, t) => acc.add(t.current_balance ?? t.balance ?? 0), Money.zero()).getAmount();

  const totalLiquidBalance = safesTotal + banksAndWalletsTotal;

  // Hardware Back Button integration
  useEffect(() => {
    if (selectedShiftToSettle) {
      return nativeBackButton.register(() => {
        setSelectedShiftToSettle(null);
        return true;
      });
    }
  }, [selectedShiftToSettle]);

  useEffect(() => {
    if (transferModalOpen) {
      return nativeBackButton.register(() => {
        setTransferModalOpen(false);
        return true;
      });
    }
  }, [transferModalOpen]);

  useEffect(() => {
    if (selectedPrintShift) {
      return nativeBackButton.register(() => {
        setSelectedPrintShift(null);
        return true;
      });
    }
  }, [selectedPrintShift]);

  useEffect(() => {
    if (createModalOpen) {
      return nativeBackButton.register(() => {
        setCreateModalOpen(false);
        return true;
      });
    }
  }, [createModalOpen]);

  const tabOptions: FilterChipOption<typeof activeTab>[] = useMemo(
    () => [
      {
        id: 'PENDING',
        label: 'ورديات بانتظار التوريد',
        count: pendingShifts.length,
        icon: Clock,
        variant: pendingShifts.length > 0 ? 'warning' : 'default',
      },
      { id: 'TREASURIES', label: 'تفاصيل الخزن والحسابات', icon: Wallet },
      { id: 'ALL_SHIFTS', label: 'سجل كافة الورديات والتقفيلات', icon: RefreshCw },
    ],
    [pendingShifts.length]
  );
  return {
    queryClient,
    canSettleShifts,
    canManageTreasury,
    canManageBanks,
    canCreateTreasury,
    canViewAllTreasuries,
    activeTab,
    setActiveTab,
    selectedBranchId,
    setSelectedBranchId,
    settlementNotes,
    setSettlementNotes,
    selectedShiftToSettle,
    setSelectedShiftToSettle,
    selectedPrintShift,
    setSelectedPrintShift,
    shiftDateFrom,
    shiftDateTo,
    shiftPage,
    setShiftPage,
    handleShiftDateChange,
    transferModalOpen,
    setTransferModalOpen,
    createModalOpen,
    setCreateModalOpen,
    transferData,
    setTransferData,
    createData,
    setCreateData,
    message,
    setMessage,
    branches,
    transferDestinations,
    isPendingLoading,
    isAllShiftsLoading,
    createTreasuryMutation,
    settleMutation,
    transferMutation,
    treasuries,
    pendingShifts,
    allShifts,
    currentShiftPage,
    lastShiftPage,
    totalShiftsCount,
    mainTreasuries,
    branchSafes,
    safes,
    banksAndWallets,
    ownerDrawings,
    drawersAndCustodies,
    mainTotal,
    branchSafesTotal,
    safesTotal,
    banksAndWalletsTotal,
    ownerDrawingsTotal,
    drawersAndCustodiesTotal,
    totalLiquidBalance,
    tabOptions,
  };
}
