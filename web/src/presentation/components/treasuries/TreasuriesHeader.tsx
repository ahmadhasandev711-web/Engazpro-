import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { Wallet, Coins, RefreshCw, CheckCircle2, AlertCircle, Send, Landmark, Building2, Plus, UserCheck } from 'lucide-react';
import type { TreasuriesViewModel } from './types';

export const TreasuriesHeader: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { queryClient, canManageTreasury, canManageBanks, canCreateTreasury, canViewAllTreasuries, selectedBranchId, setSelectedBranchId, setTransferModalOpen, setCreateModalOpen, message, setMessage, branches, pendingShifts, banksAndWallets, ownerDrawings, drawersAndCustodies, mainTotal, branchSafesTotal, safesTotal, banksAndWalletsTotal, ownerDrawingsTotal, drawersAndCustodiesTotal, totalLiquidBalance } = vm;

  return (
    <>
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
    </>
  );
};
