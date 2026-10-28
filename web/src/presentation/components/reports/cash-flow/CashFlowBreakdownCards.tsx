import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import type { SelectedTreasuryType } from './CashFlowChannelCards';

interface CashFlowBreakdownCardsProps {
  treasuryName: string;
  selectedTreasury: SelectedTreasuryType;
  inflow: any;
  outflow: any;
  netBalance: number;
  movementCategory?: string;
  onDrillDown: (category: string, flow: 'INFLOW' | 'OUTFLOW') => void;
}

export const CashFlowBreakdownCards: React.FC<CashFlowBreakdownCardsProps> = ({
  treasuryName,
  selectedTreasury,
  inflow,
  outflow,
  netBalance,
  movementCategory,
  onDrillDown,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inflow Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-sm text-slate-900">الوارد إلى {treasuryName} (+)</h4>
            </div>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {formatCurrency(inflow?.total || inflow?.total_inflow || 0)}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Sales */}
            <div
              onClick={() => onDrillDown('SALE', 'INFLOW')}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                movementCategory === 'SALE'
                  ? 'bg-emerald-50/90 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-slate-50/80 border-transparent hover:bg-slate-100/90 hover:border-slate-200'
              }`}
              title="انقر لتصفية حركات المبيعات المحصلة في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-800">مبيعات محصلة</p>
                  <span className="text-[10px] text-emerald-600 bg-emerald-100/70 px-1.5 py-0.2 rounded font-medium">
                    تصفية 🔍
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">إجمالي المبيعات المسددة عبر {treasuryName}</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(inflow?.sales ?? inflow?.cash_sales ?? 0)}
              </span>
            </div>

            {/* Receipt Vouchers */}
            <div
              onClick={() => onDrillDown('RECEIPT_VOUCHER', 'INFLOW')}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                movementCategory === 'RECEIPT_VOUCHER'
                  ? 'bg-emerald-50/90 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-slate-50/80 border-transparent hover:bg-slate-100/90 hover:border-slate-200'
              }`}
              title="انقر لتصفية سندات القبض في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-800">سندات قبض</p>
                  <span className="text-[10px] text-emerald-600 bg-emerald-100/70 px-1.5 py-0.2 rounded font-medium">
                    تصفية 🔍
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">مقبوضات سندات القبض من العملاء</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(inflow?.receipt_vouchers ?? 0)}
              </span>
            </div>

            {/* Purchase Returns */}
            <div
              onClick={() => onDrillDown('PURCHASE_RETURN', 'INFLOW')}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                movementCategory === 'PURCHASE_RETURN'
                  ? 'bg-emerald-50/90 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-slate-50/80 border-transparent hover:bg-slate-100/90 hover:border-slate-200'
              }`}
              title="انقر لتصفية مرتجعات الشراء في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-800">مرتجعات شراء مستردة</p>
                  <span className="text-[10px] text-emerald-600 bg-emerald-100/70 px-1.5 py-0.2 rounded font-medium">
                    تصفية 🔍
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">المبالغ المستردة من الموردين</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(inflow?.purchase_returns ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Outflow Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-rose-600" />
              <h4 className="font-bold text-sm text-slate-900">الصادر من {treasuryName} (-)</h4>
            </div>
            <span className="text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              {formatCurrency(outflow?.total || outflow?.total_outflow || 0)}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Purchases */}
            <div
              onClick={() => onDrillDown('PURCHASE', 'OUTFLOW')}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                movementCategory === 'PURCHASE'
                  ? 'bg-rose-50/90 border-rose-500 shadow-xs ring-1 ring-rose-500/30'
                  : 'bg-slate-50/80 border-transparent hover:bg-slate-100/90 hover:border-slate-200'
              }`}
              title="انقر لتصفية المشتريات المدفوعة في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-800">مشتريات مدفوعة</p>
                  <span className="text-[10px] text-rose-600 bg-rose-100/70 px-1.5 py-0.2 rounded font-medium">
                    تصفية 🔍
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">المدفوع للموردين لشراء بضاعة</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(outflow?.purchases ?? outflow?.cash_purchases ?? 0)}
              </span>
            </div>

            {/* Payment Vouchers */}
            <div
              onClick={() => onDrillDown('PAYMENT_VOUCHER', 'OUTFLOW')}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                movementCategory === 'PAYMENT_VOUCHER'
                  ? 'bg-rose-50/90 border-rose-500 shadow-xs ring-1 ring-rose-500/30'
                  : 'bg-slate-50/80 border-transparent hover:bg-slate-100/90 hover:border-slate-200'
              }`}
              title="انقر لتصفية سندات الصرف في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-800">سندات صرف</p>
                  <span className="text-[10px] text-rose-600 bg-rose-100/70 px-1.5 py-0.2 rounded font-medium">
                    تصفية 🔍
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">مدفوعات سندات الصرف للموردين</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(outflow?.payment_vouchers ?? 0)}
              </span>
            </div>

            {/* Sale Returns */}
            <div
              onClick={() => onDrillDown('SALE_RETURN', 'OUTFLOW')}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                movementCategory === 'SALE_RETURN'
                  ? 'bg-rose-50/90 border-rose-500 shadow-xs ring-1 ring-rose-500/30'
                  : 'bg-slate-50/80 border-transparent hover:bg-slate-100/90 hover:border-slate-200'
              }`}
              title="انقر لتصفية مرتجعات البيع في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-800">مرتجعات بيع مردودة</p>
                  <span className="text-[10px] text-rose-600 bg-rose-100/70 px-1.5 py-0.2 rounded font-medium">
                    تصفية 🔍
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">المبالغ المردودة للعملاء عند الإرجاع</p>
              </div>
              <span className="font-black text-slate-900 font-mono text-sm">
                {formatCurrency(outflow?.sale_returns ?? 0)}
              </span>
            </div>

            {/* Cash Expenses */}
            {selectedTreasury === 'CASH' && (
              <div
                onClick={() => onDrillDown('EXPENSE', 'OUTFLOW')}
                className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${
                  movementCategory === 'EXPENSE'
                    ? 'bg-rose-50/90 border-rose-500 shadow-xs ring-1 ring-rose-500/30'
                    : 'bg-slate-50/80 border-transparent hover:bg-slate-100/90 hover:border-slate-200'
                }`}
                title="انقر لتصفية المصروفات النقدية في الجدول أدناه"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-slate-800">المصروفات النقدية</p>
                    <span className="text-[10px] text-rose-600 bg-rose-100/70 px-1.5 py-0.2 rounded font-medium">
                      تصفية 🔍
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">المصروفات المنصرفة نقدًا</p>
                </div>
                <span className="font-black text-slate-900 font-mono text-sm">
                  {formatCurrency(outflow?.expenses ?? 0)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Net Balance Footer Card */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary-600" />
          <span className="font-bold text-sm text-slate-800">صافي رصيد {treasuryName}:</span>
        </div>
        <span className="text-xl font-black font-mono text-primary-700">
          {formatCurrency(netBalance)}
        </span>
      </div>
    </div>
  );
};
