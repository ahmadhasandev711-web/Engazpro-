import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, LogOut, Wallet, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../../data/api/client';
import { usePermissions } from '../../../hooks/usePermissions';
import { OpenShiftModal } from './OpenShiftModal';
import { CloseShiftModal } from './CloseShiftModal';

export const ActiveShiftBanner: React.FC = () => {
  const { canOperateShift } = usePermissions();
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const { data: shiftData, isLoading } = useQuery({
    queryKey: ['active-shift'],
    queryFn: async () => {
      const res = await apiClient.get('/shifts/active');
      return res.data?.data;
    },
    enabled: canOperateShift,
    refetchInterval: 30000,
  });

  if (!canOperateShift) return null;
  if (isLoading) return null;

  const activeShift = shiftData;

  return (
    <>
      <div className="mb-4 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3 border border-slate-800">
        {activeShift ? (
          <>
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">الوردية النشطة:</span>
                <span className="font-mono font-black">{activeShift.shift_number}</span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span>نقدية الدرج الحالية:</span>
                <span className="font-mono font-black text-amber-300 text-sm">
                  {formatCurrency(activeShift.expected_cash)}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 border-r border-slate-700 pr-3 mr-1">
                <span>مبيعات: <strong className="text-white font-mono">{formatCurrency(activeShift.cash_sales)}</strong></span>
                <span>•</span>
                <span>مصاريف: <strong className="text-rose-400 font-mono">{formatCurrency(activeShift.expenses)}</strong></span>
              </div>
            </div>

            <button
              onClick={() => setIsCloseModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تقفيل الوردية وتسليم النقدية</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>لا توجد وردية مفتوحة حالياً باسمك. افتح وردية لبدء تسجيل المبيعات النقدية والتحصيلات.</span>
            </div>

            <button
              onClick={() => setIsOpenModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl text-xs font-black transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>بدء وردية جديدة</span>
            </button>
          </>
        )}
      </div>

      <OpenShiftModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
      />

      {activeShift && (
        <CloseShiftModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          shift={activeShift}
        />
      )}
    </>
  );
};