import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import type { SelectedTreasuryType } from './CashFlowChannelCards';
import { Badge, Card } from '../../ui';

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
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-ok" />
              <h4 className="font-bold text-sm text-ink">الوارد إلى {treasuryName} (+)</h4>
            </div>
            <Badge tone="ok" className="font-black tabular-nums rounded-lg px-2.5 py-1">
              {formatCurrency(inflow?.total || inflow?.total_inflow || 0)}
            </Badge>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Sales */}
            <button
              type="button"
              onClick={() => onDrillDown('SALE', 'INFLOW')}
              className={`w-full min-h-[44px] flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer text-right ${
                movementCategory === 'SALE'
                  ? 'bg-ok-soft border-ok shadow-xs ring-1 ring-ok/30'
                  : 'bg-surface-2/80 border-transparent hover:bg-surface-2 hover:border-line'
              }`}
              title="انقر لتصفية حركات المبيعات المحصلة في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-ink">مبيعات محصلة</p>
                  <Badge tone="ok" className="text-[10px] px-1.5 py-0">
                    تصفية 🔍
                  </Badge>
                </div>
                <p className="text-[11px] text-muted">
                  إجمالي المبيعات المسددة عبر {treasuryName}
                </p>
              </div>
              <span className="font-black text-ink tabular-nums text-sm">
                {formatCurrency(inflow?.sales ?? inflow?.cash_sales ?? 0)}
              </span>
            </button>

            {/* Receipt Vouchers */}
            <button
              type="button"
              onClick={() => onDrillDown('RECEIPT_VOUCHER', 'INFLOW')}
              className={`w-full min-h-[44px] flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer text-right ${
                movementCategory === 'RECEIPT_VOUCHER'
                  ? 'bg-ok-soft border-ok shadow-xs ring-1 ring-ok/30'
                  : 'bg-surface-2/80 border-transparent hover:bg-surface-2 hover:border-line'
              }`}
              title="انقر لتصفية سندات القبض في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-ink">سندات قبض</p>
                  <Badge tone="ok" className="text-[10px] px-1.5 py-0">
                    تصفية 🔍
                  </Badge>
                </div>
                <p className="text-[11px] text-muted">مقبوضات سندات القبض من العملاء</p>
              </div>
              <span className="font-black text-ink tabular-nums text-sm">
                {formatCurrency(inflow?.receipt_vouchers ?? 0)}
              </span>
            </button>

            {/* Purchase Returns */}
            <button
              type="button"
              onClick={() => onDrillDown('PURCHASE_RETURN', 'INFLOW')}
              className={`w-full min-h-[44px] flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer text-right ${
                movementCategory === 'PURCHASE_RETURN'
                  ? 'bg-ok-soft border-ok shadow-xs ring-1 ring-ok/30'
                  : 'bg-surface-2/80 border-transparent hover:bg-surface-2 hover:border-line'
              }`}
              title="انقر لتصفية مرتجعات الشراء في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-ink">مرتجعات شراء مستردة</p>
                  <Badge tone="ok" className="text-[10px] px-1.5 py-0">
                    تصفية 🔍
                  </Badge>
                </div>
                <p className="text-[11px] text-muted">المبالغ المستردة من الموردين</p>
              </div>
              <span className="font-black text-ink tabular-nums text-sm">
                {formatCurrency(inflow?.purchase_returns ?? 0)}
              </span>
            </button>
          </div>
        </Card>

        {/* Outflow Card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-bad" />
              <h4 className="font-bold text-sm text-ink">الصادر من {treasuryName} (-)</h4>
            </div>
            <Badge tone="bad" className="font-black tabular-nums rounded-lg px-2.5 py-1">
              {formatCurrency(outflow?.total || outflow?.total_outflow || 0)}
            </Badge>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Purchases */}
            <button
              type="button"
              onClick={() => onDrillDown('PURCHASE', 'OUTFLOW')}
              className={`w-full min-h-[44px] flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer text-right ${
                movementCategory === 'PURCHASE'
                  ? 'bg-bad-soft border-bad shadow-xs ring-1 ring-bad/30'
                  : 'bg-surface-2/80 border-transparent hover:bg-surface-2 hover:border-line'
              }`}
              title="انقر لتصفية المشتريات المدفوعة في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-ink">مشتريات مدفوعة</p>
                  <Badge tone="bad" className="text-[10px] px-1.5 py-0">
                    تصفية 🔍
                  </Badge>
                </div>
                <p className="text-[11px] text-muted">المدفوع للموردين لشراء بضاعة</p>
              </div>
              <span className="font-black text-ink tabular-nums text-sm">
                {formatCurrency(outflow?.purchases ?? outflow?.cash_purchases ?? 0)}
              </span>
            </button>

            {/* Payment Vouchers */}
            <button
              type="button"
              onClick={() => onDrillDown('PAYMENT_VOUCHER', 'OUTFLOW')}
              className={`w-full min-h-[44px] flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer text-right ${
                movementCategory === 'PAYMENT_VOUCHER'
                  ? 'bg-bad-soft border-bad shadow-xs ring-1 ring-bad/30'
                  : 'bg-surface-2/80 border-transparent hover:bg-surface-2 hover:border-line'
              }`}
              title="انقر لتصفية سندات الصرف في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-ink">سندات صرف</p>
                  <Badge tone="bad" className="text-[10px] px-1.5 py-0">
                    تصفية 🔍
                  </Badge>
                </div>
                <p className="text-[11px] text-muted">مدفوعات سندات الصرف للموردين</p>
              </div>
              <span className="font-black text-ink tabular-nums text-sm">
                {formatCurrency(outflow?.payment_vouchers ?? 0)}
              </span>
            </button>

            {/* Sale Returns */}
            <button
              type="button"
              onClick={() => onDrillDown('SALE_RETURN', 'OUTFLOW')}
              className={`w-full min-h-[44px] flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer text-right ${
                movementCategory === 'SALE_RETURN'
                  ? 'bg-bad-soft border-bad shadow-xs ring-1 ring-bad/30'
                  : 'bg-surface-2/80 border-transparent hover:bg-surface-2 hover:border-line'
              }`}
              title="انقر لتصفية مرتجعات البيع في الجدول أدناه"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-ink">مرتجعات بيع مردودة</p>
                  <Badge tone="bad" className="text-[10px] px-1.5 py-0">
                    تصفية 🔍
                  </Badge>
                </div>
                <p className="text-[11px] text-muted">المبالغ المردودة للعملاء عند الإرجاع</p>
              </div>
              <span className="font-black text-ink tabular-nums text-sm">
                {formatCurrency(outflow?.sale_returns ?? 0)}
              </span>
            </button>

            {/* Cash Expenses */}
            {selectedTreasury === 'CASH' && (
              <button
                type="button"
                onClick={() => onDrillDown('EXPENSE', 'OUTFLOW')}
                className={`w-full min-h-[44px] flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer text-right ${
                  movementCategory === 'EXPENSE'
                    ? 'bg-bad-soft border-bad shadow-xs ring-1 ring-bad/30'
                    : 'bg-surface-2/80 border-transparent hover:bg-surface-2 hover:border-line'
                }`}
                title="انقر لتصفية المصروفات النقدية في الجدول أدناه"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-ink">المصروفات النقدية</p>
                    <Badge tone="bad" className="text-[10px] px-1.5 py-0">
                      تصفية 🔍
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted">المصروفات المنصرفة نقدًا</p>
                </div>
                <span className="font-black text-ink tabular-nums text-sm">
                  {formatCurrency(outflow?.expenses ?? 0)}
                </span>
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Net Balance Footer Card */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand" />
          <span className="font-bold text-sm text-ink">صافي رصيد {treasuryName}:</span>
        </div>
        <span className="text-xl font-black tabular-nums text-brand">
          {formatCurrency(netBalance)}
        </span>
      </Card>
    </div>
  );
};
