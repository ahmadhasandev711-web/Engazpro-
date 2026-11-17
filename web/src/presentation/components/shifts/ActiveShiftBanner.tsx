import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, LogOut, Wallet, AlertCircle, Printer } from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../../data/api/client';
import { usePermissions } from '../../../hooks/usePermissions';
import { OpenShiftModal } from './OpenShiftModal';
import { CloseShiftModal } from './CloseShiftModal';
import { ShiftZReportModal, ShiftZReportData } from './ShiftZReportModal';
import { Badge, Button, Card } from '../ui';

export const ActiveShiftBanner: React.FC = () => {
  const { canOperateShift } = usePermissions();
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [shiftForZReport, setShiftForZReport] = useState<ShiftZReportData | null>(null);

  const { data: shiftData, isLoading } = useQuery({
    queryKey: ['active-shift'],
    queryFn: async () => {
      const res = await apiClient.get('/shifts/active');
      return res.data?.data;
    },
    enabled: canOperateShift,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  });

  const activeShift = shiftData;

  const { data: latestClosedShift } = useQuery({
    queryKey: ['my-latest-closed-shift', activeShift?.id],
    queryFn: async () => {
      const res = await apiClient.get('/shifts', { params: { per_page: 1 } });
      const list = res.data?.data || [];
      return list.length > 0 ? (list[0] as ShiftZReportData) : null;
    },
    enabled: !activeShift && canOperateShift,
  });

  if (!canOperateShift) return null;
  if (isLoading) return null;

  return (
    <>
      <Card className="mb-4 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {activeShift ? (
          <>
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <Badge tone="ok" dot className="px-3 py-1">
                <span>الوردية النشطة:</span>
                <span className="tabular-nums font-black">{activeShift.shift_number}</span>
              </Badge>

              <div className="flex items-center gap-1.5 text-muted">
                <Wallet className="w-3.5 h-3.5 text-warn" />
                <span>نقدية الدرج الحالية:</span>
                <span className="tabular-nums font-black text-warn text-sm">
                  {formatCurrency(activeShift.expected_cash)}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted border-r border-line pr-3 mr-1">
                <span>مبيعات: <strong className="text-ok tabular-nums">{formatCurrency(activeShift.cash_sales)}</strong></span>
                <span>•</span>
                <span>مصاريف: <strong className="text-bad tabular-nums">{formatCurrency(activeShift.expenses)}</strong></span>
              </div>
            </div>

            <Button
              variant="danger"
              size="md"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              onClick={() => setIsCloseModalOpen(true)}
              className="text-xs font-bold"
            >
              تقفيل الوردية وتسليم النقدية
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-warn font-medium">
              <AlertCircle className="w-4 h-4 text-warn flex-shrink-0" />
              <span>لا توجد وردية مفتوحة حالياً باسمك. افتح وردية لبدء تسجيل المبيعات النقدية والتحصيلات.</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {latestClosedShift && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  leftIcon={<Printer className="w-3.5 h-3.5 text-warn" />}
                  onClick={() => setShiftForZReport(latestClosedShift)}
                  className="text-xs font-bold tabular-nums"
                  title="طباعة بون إغلاق آخر وردية تم إغلاقها"
                >
                  بون آخر وردية ({latestClosedShift.shift_number})
                </Button>
              )}

              <Button
                type="button"
                variant="primary"
                size="md"
                leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                onClick={() => setIsOpenModalOpen(true)}
                className="text-xs font-black"
              >
                بدء وردية جديدة
              </Button>
            </div>
          </>
        )}
      </Card>

      <OpenShiftModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
      />

      {activeShift && (
        <CloseShiftModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          onClosedSuccess={(closedShift) => {
            setIsCloseModalOpen(false);
            setShiftForZReport(closedShift);
          }}
          shift={activeShift}
        />
      )}

      {/* Persistent Shift Z-Report Modal (Does not unmount when activeShift becomes null) */}
      <ShiftZReportModal
        isOpen={Boolean(shiftForZReport)}
        onClose={() => setShiftForZReport(null)}
        shift={shiftForZReport}
      />
    </>
  );
};