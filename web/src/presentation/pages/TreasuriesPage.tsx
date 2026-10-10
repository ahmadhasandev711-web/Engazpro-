import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Coins,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Send,
  TrendingDown,
  TrendingUp,
  Landmark,
  Smartphone,
  Building2,
  Plus,
  UserCheck,
  Store,
  X,
} from 'lucide-react';
import { formatCurrency, TreasuryType, Money } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';

export const TreasuriesPage: React.FC = () => {
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

  // Fetch All Shifts History
  const { data: allShiftsData, isLoading: isAllShiftsLoading } = useQuery({
    queryKey: ['shifts', 'ALL', selectedBranchId],
    queryFn: async () => {
      const params: any = {};
      if (selectedBranchId) params.branch_id = selectedBranchId;
      const res = await apiClient.get('/shifts', { params });
      return res.data?.data || [];
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
  const allShifts: any[] = allShiftsData || [];

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

  return (
    <div className="space-y-3 sm:space-y-6 flex flex-col h-full" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:flex sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">إدارة الخزن والحسابات المالية</h2>
            {pendingShifts.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                {pendingShifts.length} بانتظار التوريد
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            متابعة أرصدة الخزن، البنوك والمحافظ، واعتماد توريد تقفيلات الورديات والتحويلات المالية
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Branch filter for Owner/Admin */}
          {canViewAllTreasuries && branches.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
              <Building2 className="w-4 h-4 text-primary-600" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-xs font-bold text-slate-800 cursor-pointer"
              >
                <option value="">جميع الفروع والمقرات</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    فرع: {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canCreateTreasury && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة خزينة / حساب</span>
            </button>
          )}

          {canManageTreasury && (
            <button
              onClick={() => setTransferModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Send className="w-4 h-4 text-slate-500" />
              <span>تحويل بين الخزن</span>
            </button>
          )}

          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['shifts'] });
              queryClient.invalidateQueries({ queryKey: ['treasuries'] });
            }}
            title="تحديث البيانات"
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">الخزن والورديات</h2>
              {pendingShifts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse shrink-0">
                  {pendingShifts.length} معلق
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              السيولة: <span className="font-bold text-emerald-700 font-mono">{formatCurrency(totalLiquidBalance)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canManageTreasury && (
            <button
              onClick={() => setTransferModalOpen(true)}
              className="inline-flex items-center gap-1 bg-slate-800 active:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>تحويل</span>
            </button>
          )}
          {canCreateTreasury && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1 bg-primary-600 active:bg-primary-700 text-white p-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
              title="إضافة خزينة"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-3 sm:p-4 rounded-2xl flex items-center justify-between text-xs font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* Mobile 2-Column Quick Summary Strip (md:hidden) */}
      <div className="md:hidden grid grid-cols-2 gap-2 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs text-center">
        <div className="bg-slate-900 text-white p-2.5 rounded-xl">
          <span className="text-[10px] text-slate-300 font-bold block">الخزائن النقدية</span>
          <span className="text-sm font-black text-emerald-400 font-mono block mt-0.5" dir="ltr">
            {formatCurrency(safesTotal)}
          </span>
        </div>
        <div className="bg-blue-50/80 border border-blue-100 p-2.5 rounded-xl">
          <span className="text-[10px] text-blue-700 font-bold block">البنوك والمحافظ</span>
          <span className="text-sm font-black text-blue-800 font-mono block mt-0.5" dir="ltr">
            {formatCurrency(banksAndWalletsTotal)}
          </span>
        </div>
      </div>

      {/* Desktop Overview Stat Cards */}
      <div className={`hidden md:grid grid-cols-1 ${canManageBanks ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-4`}>
        {/* 1. الخزائن النقدية */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">الخزائن النقدية (Safes)</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono tracking-tight">
              {formatCurrency(safesTotal)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>المركزية: <strong className="text-white font-mono">{formatCurrency(mainTotal)}</strong></span>
            <span>الفروع: <strong className="text-emerald-400 font-mono">{formatCurrency(branchSafesTotal)}</strong></span>
          </div>
        </div>

        {/* 2. الحسابات البنكية والمحافظ (خاصة بالمالك والإدارة العليا) */}
        {canManageBanks && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">البنوك والمحافظ الإلكترونية</span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-200">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-slate-900">
                {formatCurrency(banksAndWalletsTotal)}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>فودافون كاش، إنستاباي، وبنوك</span>
              <span className="font-bold text-sky-700">{banksAndWallets.length} حسابات</span>
            </div>
          </div>
        )}

        {/* 3. أدراج الكاشير وعهد المناديب */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">أدراج POS وعهد المناديب</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-slate-900">
              {formatCurrency(drawersAndCustodiesTotal)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>سيولة لدى الكاشيرات والمناديب</span>
            <span className="font-bold text-amber-700">{drawersAndCustodies.length} أفراد</span>
          </div>
        </div>

        {/* 4. جاري المالك والمسحوبات الشخصية */}
        {canManageBanks && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">جاري الشركاء والمسحوبات</span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-200">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-slate-900">
                {formatCurrency(ownerDrawingsTotal)}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>مسحوبات الشركاء المحولة</span>
              <span className="font-bold text-purple-700">{ownerDrawings.length} حسابات</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation (Horizontal Scroll Track) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth flex-nowrap text-xs border-b border-slate-200">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'PENDING'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>ورديات بانتظار التوريد</span>
          {pendingShifts.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'PENDING' ? 'bg-white text-primary-700' : 'bg-rose-500 text-white'}`}>
              {pendingShifts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('TREASURIES')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'TREASURIES'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>تفاصيل الخزن والحسابات</span>
        </button>

        <button
          onClick={() => setActiveTab('ALL_SHIFTS')}
          className={`pb-3 px-4 text-xs font-bold transition-all relative ${
            activeTab === 'ALL_SHIFTS'
              ? 'text-primary-700 border-b-2 border-primary-600 font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>سجل كافة الورديات والتقفيلات</span>
        </button>
      </div>

      {/* Tab 1: Pending Handover Settlements */}
      {activeTab === 'PENDING' && (
        <div className="space-y-4 flex-1">
          {isPendingLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">جاري تحميل الورديات المعلقة...</div>
          ) : pendingShifts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">لا توجد ورديات معلقة بانتظار التوريد</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                جميع الورديات التي تم تقفيلها تم توريدها واعتمادها في خزينة الفرع / الخزينة الرئيسية بنجاح.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pendingShifts.map((shift: any) => {
                const diff = shift.difference || 0;
                const isDiffZero = diff === 0;
                const isSurplus = diff > 0;

                return (
                  <div
                    key={shift.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-xl">
                            {shift.shift_number}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {shift.user?.name || shift.created_by_name || 'موظف'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700">
                            {(shift.user?.role || shift.created_by_role) === 'MANDOB' ? 'مندوب' : 'كاشير'}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString('ar-EG') : ''}
                        </span>
                      </div>

                      {/* Financial Breakdown Grid */}
                      <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">رصيد الافتتاح:</span>
                          <span className="font-bold text-slate-700 font-mono">
                            {formatCurrency(shift.opening_balance)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">مبيعات كاش:</span>
                          <span className="font-bold text-emerald-600 font-mono">
                            +{formatCurrency(shift.cash_sales)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">تحصيلات عملاء:</span>
                          <span className="font-bold text-emerald-600 font-mono">
                            +{formatCurrency(shift.cash_receipts)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-slate-400 text-[11px] block">مصروفات:</span>
                          <span className="font-bold text-rose-600 font-mono">
                            -{formatCurrency(shift.expenses)}
                          </span>
                        </div>
                      </div>

                      {/* Expected vs Actual */}
                      <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">النقدية المتوقعة (النظام):</span>
                          <span className="font-mono font-bold">{formatCurrency(shift.expected_cash)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">المبلغ الفعلي المورد:</span>
                          <span className="font-mono font-black text-amber-300 text-sm">
                            {formatCurrency(shift.actual_cash)}
                          </span>
                        </div>

                        {/* Difference Alert */}
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-400">نتيجة المطابقة:</span>
                          {isDiffZero ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              مطابق تماماً (0.00)
                            </span>
                          ) : isSurplus ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                              <TrendingUp className="w-3.5 h-3.5" />
                              زيادة +{formatCurrency(diff)}
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold flex items-center gap-1 text-[11px]">
                              <TrendingDown className="w-3.5 h-3.5" />
                              عجز {formatCurrency(diff)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes if any */}
                      {shift.notes && (
                        <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-600">
                          <strong className="text-slate-700">ملاحظات الموظف:</strong> {shift.notes}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      {canSettleShifts ? (
                        <button
                          onClick={() => setSelectedShiftToSettle(shift)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-xs font-black shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>تأكيد استلام النقدية والتوريد للخزينة ({formatCurrency(shift.actual_cash)})</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          يتطلب صلاحية المالك، المدير، أو المشرف لاعتماد الاستلام
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Treasuries Detail */}
      {activeTab === 'TREASURIES' && (
        <div className="space-y-6">
          {/* 1. الخزينة المركزية العامة (الإدارة المركزية / Master Treasury) */}
          {canManageTreasury && mainTreasuries.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 border border-slate-800 text-white shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">الخزينة المركزية العامة (الإدارة)</h3>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Master Treasury
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      الخزينة الرئيسية للمنشأة ككل (خاصة بالإدارة وصاحب العمل، تستقبل توريدات الفروع والتحويلات الكبرى)
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-slate-400 block">رصيد الخزينة المركزية</span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    {formatCurrency(mainTotal)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                {mainTreasuries.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 hover:bg-slate-800 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">{t.name}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        خزينة مركزية
                      </span>
                    </div>

                    <div className="text-2xl font-black font-mono text-emerald-400">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                      <span>الإدارة المركزية العامة</span>
                      <span className="font-mono text-[10px] text-slate-500">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. خزائن الفروع التشغيلية (Branch Safes) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary-600" />
                  <span>خزائن الفروع التشغيلية (Branch Safes)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  خزائن نقدية مستقلة لكل فرع تجاري، يُورّد إليها الكاشير نقدية الوردية بعد الاعتماد
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600">
                إجمالي رصيد خزن الفروع: {formatCurrency(branchSafesTotal)}
              </span>
            </div>

            {branchSafes.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
                <p className="text-xs text-slate-400">لا توجد خزائن فروع مسجلة حالياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branchSafes.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{t.name}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-primary-50 text-primary-700 border border-primary-100">
                        خزينة فرع
                      </span>
                    </div>

                    <div className="text-xl font-black font-mono text-slate-900">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span>{t.branch_name ? `فرع: ${t.branch_name}` : 'فرع تجاري'}</span>
                      <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. الحسابات البنكية والمحافظ الإلكترونية (خاصة بالمالك والإدارة العليا) */}
          {canManageBanks && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-sky-600" />
                    <span>الحسابات البنكية والمحافظ الإلكترونية</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    حسابات سرية خاصة بالإدارة العليا والمالك، لا تظهر للكاشير أو المناديب
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-sky-700">
                  الإجمالي: {formatCurrency(banksAndWalletsTotal)}
                </span>
              </div>

              {banksAndWallets.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 mb-2">لم تقم بإضافة أي حسابات بنكية أو محافظ بعد</p>
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بنك أو محفظة الآن</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banksAndWallets.map((t: any) => {
                    const isBank = t.type === 'BANK';
                    return (
                      <div
                        key={t.id}
                        className="p-5 rounded-2xl border border-sky-100 bg-sky-50/30 hover:bg-sky-50/60 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isBank ? (
                              <Landmark className="w-4 h-4 text-sky-600" />
                            ) : (
                              <Smartphone className="w-4 h-4 text-indigo-600" />
                            )}
                            <span className="text-xs font-black text-slate-900">{t.name}</span>
                          </div>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                              isBank ? 'bg-sky-100 text-sky-800' : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {isBank ? 'حساب بنكي' : 'محفظة إلكترونية'}
                          </span>
                        </div>

                        <div className="text-xl font-black font-mono text-slate-900">
                          {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                        </div>

                        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="truncate max-w-[160px]">{t.notes || (isBank ? 'تحويلات وفيزا' : 'فودافون كاش / إنستاباي')}</span>
                          <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. مسحوبات الشركاء والمالك (خاصة بالمالك والإدارة العليا) */}
          {canManageBanks && ownerDrawings.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-purple-600" />
                    <span>حسابات جاري الشركاء والمسحوبات الشخصية</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    تتبع المبالغ والمسحوبات التي تم تحويلها لصالح الشركاء والمالك
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-700">
                  الإجمالي: {formatCurrency(ownerDrawingsTotal)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownerDrawings.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50/60 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{t.name}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800">
                        جاري المالك
                      </span>
                    </div>

                    <div className="text-xl font-black font-mono text-purple-900">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span>{t.notes || 'مسحوبات أرباح وشخصية'}</span>
                      <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. أدراج الكاشير وعهد المناديب الفردية */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>أدراج نقاط البيع (POS) وعهد المناديب الميدانية</span>
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500">
                إجمالي العهد: {formatCurrency(drawersAndCustodiesTotal)}
              </span>
            </div>

            {drawersAndCustodies.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">لا توجد أدراج كاشير أو عهد مناديب حالياً</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drawersAndCustodies.map((t: any) => {
                  const isDrawer = t.type === 'CASHIER_DRAWER';
                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">{t.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isDrawer ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {isDrawer ? 'درج كاشير' : 'عهدة مندوب'}
                        </span>
                      </div>

                      <div className="text-lg font-black font-mono text-slate-900">
                        {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                      </div>

                      <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span>المسؤول: {t.employee?.name || t.assigned_user_name || 'الكاشير'}</span>
                        <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Shifts History */}
      {activeTab === 'ALL_SHIFTS' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">رقم الوردية</th>
                  <th className="py-3 px-4">الموظف / الدور</th>
                  <th className="py-3 px-4">وقت الفتح</th>
                  <th className="py-3 px-4">وقت التقفيل</th>
                  <th className="py-3 px-4">مبيعات كاش</th>
                  <th className="py-3 px-4">المتوقع</th>
                  <th className="py-3 px-4">الفعلي المستلم</th>
                  <th className="py-3 px-4">الفرق</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">المعتمد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isAllShiftsLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      جاري تحميل سجل الورديات...
                    </td>
                  </tr>
                ) : allShifts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      لا يوجد أي ورديات مسجلة بعد.
                    </td>
                  </tr>
                ) : (
                  allShifts.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.shift_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{s.user?.name || s.created_by_name || '-'}</div>
                        <div className="text-[10px] text-slate-400">
                          {(() => {
                            const role = s.user?.role || s.created_by_role;
                            if (role === 'MANDOB') return 'مندوب مبيعات';
                            if (role === 'SUPERVISOR') return 'مشرف ورديات';
                            if (role === 'MANAGER') return 'مدير فرع';
                            if (role === 'OWNER') return 'صاحب المنشأة';
                            return 'كاشير POS';
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(s.opened_at).toLocaleDateString('ar-EG')} {new Date(s.opened_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {s.closed_at
                          ? `${new Date(s.closed_at).toLocaleDateString('ar-EG')} ${new Date(s.closed_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                        {formatCurrency(s.cash_sales)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {formatCurrency(s.expected_cash)}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        {s.actual_cash != null ? formatCurrency(s.actual_cash) : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {s.difference === 0 ? (
                          <span className="text-emerald-600">0.00</span>
                        ) : s.difference > 0 ? (
                          <span className="text-amber-600">+{formatCurrency(s.difference)}</span>
                        ) : (
                          <span className="text-rose-600">{formatCurrency(s.difference)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'SETTLED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'CLOSED'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.status === 'SETTLED'
                            ? 'تم التوريد'
                            : s.status === 'CLOSED'
                            ? 'معلق للاستلام'
                            : 'نشط حالياً'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.settled_by_user?.name || s.settled_by_name || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Shift History Cards View */}
          <div className="md:hidden divide-y divide-slate-100">
            {isAllShiftsLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">جاري تحميل سجل الورديات...</div>
            ) : allShifts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">لا يوجد أي ورديات مسجلة بعد.</div>
            ) : (
              allShifts.map((s: any) => (
                <div key={s.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {s.shift_number}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">
                        {s.user?.name || s.created_by_name || '-'}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {(() => {
                          const role = s.user?.role || s.created_by_role;
                          if (role === 'MANDOB') return 'مندوب مبيعات';
                          if (role === 'SUPERVISOR') return 'مشرف ورديات';
                          if (role === 'MANAGER') return 'مدير فرع';
                          if (role === 'OWNER') return 'صاحب المنشأة';
                          return 'كاشير POS';
                        })()}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        s.status === 'SETTLED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'CLOSED'
                          ? 'bg-rose-100 text-rose-800 animate-pulse'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status === 'SETTLED'
                        ? 'تم التوريد'
                        : s.status === 'CLOSED'
                        ? 'معلق للاستلام'
                        : 'نشط حالياً'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>مبيعات كاش:</span>
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(s.cash_sales)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>المتوقع:</span>
                      <span className="font-mono font-bold text-slate-700">{formatCurrency(s.expected_cash)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-sans border-t border-slate-200/60 pt-1 font-bold">
                      <span>الفعلي المستلم:</span>
                      <span className="font-mono font-black">{s.actual_cash != null ? formatCurrency(s.actual_cash) : '-'}</span>
                    </div>
                    {s.difference !== 0 && (
                      <div className="flex justify-between font-sans border-t border-slate-200/60 pt-1 font-bold">
                        <span>الفرق / العجز:</span>
                        <span className={`font-mono ${s.difference > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {s.difference > 0 ? `+${formatCurrency(s.difference)}` : formatCurrency(s.difference)}
                        </span>
                      </div>
                    )}
                  </div>

                  {s.settled_by_user?.name && (
                    <p className="text-[11px] text-slate-400 pt-1">
                      المعتمد: {s.settled_by_user.name}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create Treasury / Bank Modal - Responsive Bottom Sheet */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/20 text-primary-400 rounded-xl border border-primary-500/30">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">إضافة خزينة أو حساب جديد</h3>
                  <p className="text-xs text-slate-400 mt-0.5">تسجيل بنك، محفظة إلكترونية، خزينة فرع، أو مسحوبات</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTreasuryMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">نوع الخزينة / الحساب *</label>
                <select
                  required
                  value={createData.type}
                  onChange={(e) => setCreateData({ ...createData, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="BANK">حساب بنكي (بنك مصر، CIB، الأهلي...)</option>
                  <option value="WALLET">محفظة إلكترونية (فودافون كاش، إنستاباي...)</option>
                  <option value="BRANCH_SAFE">خزينة فرع رئيسية (Branch Safe)</option>
                  <option value="OWNER_DRAWINGS">جاري المالك / مسحوبات شخصية</option>
                  <option value="CASHIER_DRAWER">درج كاشير جديد</option>
                  <option value="MANDOB_CUSTODY">عهدة مندوب مبيعات</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">اسم الخزينة أو الحساب *</label>
                <input
                  type="text"
                  required
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  placeholder={
                    createData.type === 'BANK'
                      ? 'مثال: حساب البنك الأهلي المصري'
                      : createData.type === 'WALLET'
                      ? 'مثال: محفظة فودافون كاش (010...)'
                      : createData.type === 'BRANCH_SAFE'
                      ? 'مثال: خزينة فرع المعادي'
                      : createData.type === 'OWNER_DRAWINGS'
                      ? 'مثال: جاري المالك أحمد'
                      : 'اسم الخزينة...'
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Branch Association */}
              {branches.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">الفرع المرتبط (اختياري):</label>
                  <select
                    value={createData.branch_id}
                    onChange={(e) => setCreateData({ ...createData, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">-- الإدارة المركزية / عام للشركة --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">الرصيد الافتتاحي (ج.م):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createData.opening_balance}
                  onChange={(e) => setCreateData({ ...createData, opening_balance: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ملاحظات / رقم الحساب أو الموبايل:</label>
                <textarea
                  rows={2}
                  value={createData.notes}
                  onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                  placeholder="رقم الحساب البنكي، أو رقم المحفظة، أو تعليمات..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={createTreasuryMutation.isPending || !createData.name.trim()}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-black shadow-sm transition-all disabled:opacity-50"
                >
                  {createTreasuryMutation.isPending ? 'جاري الإنشاء...' : 'حفظ الخزينة'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Confirmation Modal - Responsive Bottom Sheet */}
      {selectedShiftToSettle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تأكيد استلام وتوريد النقدية</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    الوردية: {selectedShiftToSettle.shift_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShiftToSettle(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-2">
                <div className="flex justify-between items-center text-emerald-900 font-bold">
                  <span>المبلغ المحصّل باليد:</span>
                  <span className="font-mono text-base font-black text-emerald-700">
                    {formatCurrency(selectedShiftToSettle.actual_cash)}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 leading-relaxed">
                  سيتم تحويل هذا المبلغ مباشرة من عهدة{' '}
                  <strong>{selectedShiftToSettle.user?.name}</strong> وإيداعه في خزينة الفرع / الخزينة الرئيسية،
                  وإغلاق دورة الوردية رسمياً.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  ملاحظات الاستلام / إيصال التوريد (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="تم استلام المبلغ نقداً ومطابقته بالخزينة..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={settleMutation.isPending}
                  onClick={() =>
                    settleMutation.mutate({
                      shiftId: selectedShiftToSettle.id,
                      notes: settlementNotes,
                    })
                  }
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {settleMutation.isPending ? 'جاري الاعتماد...' : 'تأكيد الاستلام والإيداع في الخزينة'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShiftToSettle(null)}
                  className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal - Responsive Bottom Sheet */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary-500/20 text-primary-400 rounded-2xl border border-primary-500/30">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تحويل أموال بين الخزن والحسابات</h3>
                  <p className="text-xs text-slate-400 mt-0.5">نقل رصيد بين الخزينة الرئيسية، البنوك، والأدراج</p>
                </div>
              </div>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                transferMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">التحويل من خزينة / حساب:</label>
                <select
                  required
                  value={transferData.from_treasury_id}
                  onChange={(e) =>
                    setTransferData({ ...transferData, from_treasury_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">-- اختر الخزينة المحول منها --</option>
                  {treasuries.map((t: any) => {
                    const typeLabel =
                      t.type === 'MAIN'
                        ? '🏛️ الخزينة المركزية (الإدارة)'
                        : t.type === 'BRANCH_SAFE'
                        ? `🏢 فرع: ${t.branch_name || ''}`
                        : t.type === 'BANK'
                        ? '💳 حساب بنكي'
                        : t.type === 'WALLET'
                        ? '📱 محفظة إلكترونية'
                        : t.type === 'OWNER_DRAWINGS'
                        ? '👤 جاري المالك'
                        : '🏪 درج / عهدة';
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} [{typeLabel}] (الرصيد: {formatCurrency(t.current_balance)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">التحويل إلى خزينة / حساب:</label>
                <select
                  required
                  value={transferData.to_treasury_id}
                  onChange={(e) =>
                    setTransferData({ ...transferData, to_treasury_id: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">-- اختر الخزينة المحول إليها --</option>
                  {transferDestinations
                    .filter((t: any) => t.id !== Number(transferData.from_treasury_id))
                    .map((t: any) => {
                      const typeLabel =
                        t.type === 'MAIN'
                          ? '🏛️ الخزينة المركزية (الإدارة)'
                          : t.type === 'BRANCH_SAFE'
                          ? `🏢 فرع: ${t.branch_name || ''}`
                          : t.type === 'BANK'
                          ? '💳 حساب بنكي'
                          : t.type === 'WALLET'
                          ? '📱 محفظة إلكترونية'
                          : t.type === 'OWNER_DRAWINGS'
                          ? '👤 جاري المالك'
                          : '🏪 درج / عهدة';
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} [{typeLabel}] (الرصيد: {formatCurrency(t.current_balance)})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">المبلغ المحول (ج.م):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ملاحظات التحويل:</label>
                <textarea
                  rows={2}
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                  placeholder="سبب التحويل، رقم العملية، أو إيداع بنكي..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl text-xs font-black shadow-sm transition-all disabled:opacity-50"
                >
                  {transferMutation.isPending ? 'جاري التحويل...' : 'تأكيد التحويل المالي'}
                </button>
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};