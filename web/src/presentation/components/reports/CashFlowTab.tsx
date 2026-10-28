import React, { useState, useRef, useEffect } from 'react';
import { CashFlowReportData, CashFlowTransaction } from '@pos-mandob/shared';
import { useCashFlowTransactions, fetchAllCashFlowTransactions } from '../../../hooks/useReports';
import { CashFlowGuidanceBanner } from './cash-flow/CashFlowGuidanceBanner';
import { CashFlowTotalBanner } from './cash-flow/CashFlowTotalBanner';
import { CashFlowChannelCards, SelectedTreasuryType } from './cash-flow/CashFlowChannelCards';
import { CashFlowBreakdownCards } from './cash-flow/CashFlowBreakdownCards';
import { CashFlowTransactionsTable } from './cash-flow/CashFlowTransactionsTable';

export type { SelectedTreasuryType } from './cash-flow/CashFlowChannelCards';

export interface CashFlowPrintData {
  treasuryName: string;
  transactions: CashFlowTransaction[];
  flowFilter: 'ALL' | 'INFLOW' | 'OUTFLOW';
  movementCategory?: string;
  search?: string;
  preset: string;
  fromDate?: string;
  toDate?: string;
}

interface CashFlowTabProps {
  data?: CashFlowReportData;
  isLoading: boolean;
  selectedTreasury: SelectedTreasuryType;
  onSelectTreasury: (t: SelectedTreasuryType) => void;
  preset: string;
  fromDate?: string;
  toDate?: string;
  onUpdatePrintData?: (printData: CashFlowPrintData) => void;
}

export const CashFlowTab: React.FC<CashFlowTabProps> = ({
  data,
  isLoading,
  selectedTreasury,
  onSelectTreasury,
  preset,
  fromDate,
  toDate,
  onUpdatePrintData,
}) => {
  // Collapsed by default to keep the overview clean and fast
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [flowFilter, setFlowFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [movementCategory, setMovementCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);

  const treasuryName =
    selectedTreasury === 'CASH'
      ? 'متحصلات المبيعات النقدية (الكاش)'
      : selectedTreasury === 'CARD'
      ? 'متحصلات البطاقة (POS)'
      : selectedTreasury === 'INSTAPAY'
      ? 'متحصلات إنستاباي (InstaPay)'
      : selectedTreasury === 'VODAFONE_CASH'
      ? 'متحصلات فودافون كاش والمحافظ'
      : 'متحصلات التحويلات البنكية المباشرة';

  // Reset page, drill-down and search on filter/treasury change
  useEffect(() => {
    setPage(1);
    setMovementCategory(undefined);
    setFlowFilter('ALL');
    setSearch('');
  }, [selectedTreasury, fromDate, toDate]);

  // Query transactions strictly on-demand (only when table is open)
  const { data: txResponse, isLoading: isTxLoading } = useCashFlowTransactions(
    {
      channel: selectedTreasury,
      fromDate,
      toDate,
      flowType: flowFilter,
      movementCategory,
      search,
      page,
      perPage: 15,
    },
    isTableOpen && !isLoading
  );

  // Sync active transactions & filters with parent for printable view (Top-level Hook before any returns)
  useEffect(() => {
    if (txResponse?.data) {
      onUpdatePrintData?.({
        treasuryName,
        transactions: txResponse.data,
        flowFilter,
        movementCategory,
        search,
        preset,
        fromDate,
        toDate,
      });
    }
  }, [txResponse, treasuryName, flowFilter, movementCategory, search, preset, fromDate, toDate, onUpdatePrintData]);

  if (isLoading) {
    return (
      <div className="text-center py-16 text-sm text-slate-400 font-medium">
        جاري احتساب حركة الخزن والنقدية...
      </div>
    );
  }

  const treasuries = data?.treasuries;
  const currentTreasury =
    selectedTreasury === 'CASH'
      ? treasuries?.cash
      : selectedTreasury === 'CARD'
      ? treasuries?.card
      : selectedTreasury === 'INSTAPAY'
      ? treasuries?.instapay
      : selectedTreasury === 'VODAFONE_CASH'
      ? treasuries?.vodafone_cash
      : treasuries?.transfer;

  const inflow =
    currentTreasury?.inflow ||
    (selectedTreasury === 'CASH'
      ? data?.inflow
      : { sales: 0, receipt_vouchers: 0, purchase_returns: 0, total: 0 });

  const outflow =
    currentTreasury?.outflow ||
    (selectedTreasury === 'CASH'
      ? data?.outflow
      : { purchases: 0, payment_vouchers: 0, sale_returns: 0, expenses: 0, total: 0 });

  const netBalance =
    currentTreasury?.net_balance ??
    (selectedTreasury === 'CASH' ? data?.net_cash_flow || 0 : 0);

  const handleDrillDown = (category: string, flow: 'INFLOW' | 'OUTFLOW') => {
    if (movementCategory === category) {
      setMovementCategory(undefined);
      setFlowFilter('ALL');
    } else {
      setMovementCategory(category);
      setFlowFilter(flow);
    }
    setPage(1);
    setIsTableOpen(true);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
  };

  const handleClearDrillDown = () => {
    setMovementCategory(undefined);
    setFlowFilter('ALL');
    setPage(1);
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      let printItems: CashFlowTransaction[] = [];
      if (txResponse?.data && txResponse.meta && txResponse.meta.total <= txResponse.data.length) {
        printItems = txResponse.data;
      } else {
        const res = await fetchAllCashFlowTransactions({
          channel: selectedTreasury,
          fromDate,
          toDate,
          flowType: flowFilter,
          movementCategory,
          search,
          perPage: 200,
        });
        printItems = res.data || [];
      }

      onUpdatePrintData?.({
        treasuryName,
        transactions: printItems,
        flowFilter,
        movementCategory,
        search,
        preset,
        fromDate,
        toDate,
      });

      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 100);
    } catch (err) {
      console.error('Failed to prepare print transactions:', err);
      setIsPrinting(false);
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Guidance Information Banner */}
      <CashFlowGuidanceBanner />

      {/* 2. Total Net Funds Banner */}
      <CashFlowTotalBanner data={data} preset={preset} />

      {/* 3. Five Payment Channel Cards */}
      <CashFlowChannelCards
        data={data}
        selectedTreasury={selectedTreasury}
        onSelectTreasury={onSelectTreasury}
      />

      {/* 4. Inflow & Outflow Breakdown Cards */}
      <CashFlowBreakdownCards
        treasuryName={treasuryName}
        selectedTreasury={selectedTreasury}
        inflow={inflow}
        outflow={outflow}
        netBalance={netBalance}
        movementCategory={movementCategory}
        onDrillDown={handleDrillDown}
      />

      {/* 5. On-Demand Collapsible & Searchable Transactions Table */}
      <div ref={tableRef}>
        <CashFlowTransactionsTable
          treasuryName={treasuryName}
          isTableOpen={isTableOpen}
          onToggleTable={() => setIsTableOpen(!isTableOpen)}
          transactions={txResponse?.data || []}
          isLoading={isTxLoading}
          meta={txResponse?.meta}
          flowFilter={flowFilter}
          onFlowFilterChange={(flow) => {
            setFlowFilter(flow);
            setMovementCategory(undefined);
            setPage(1);
          }}
          movementCategory={movementCategory}
          onClearDrillDown={handleClearDrillDown}
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          page={page}
          onPageChange={setPage}
          onPrint={handlePrint}
          isPrinting={isPrinting}
        />
      </div>
    </div>
  );
};
