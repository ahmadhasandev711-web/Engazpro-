import React from 'react';
import {
  Phone,
  MapPin,
  Package,
  FileText,
  ArrowDownLeft,
  Edit2,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { MobileCard } from './MobileCard';
import { Badge } from '../ui';
import { useHaptic } from '../../hooks/useHaptic';

interface CourierMobileCardProps {
  courier: any;
  canDeleteParty: boolean;
  onOpenManifest: (courier: any) => void;
  onOpenSettle: (courier: any, type?: 'RECEIPT' | 'PAYMENT') => void;
  onOpenLedger: (courierId: number) => void;
  onEditCourier: (courier: any) => void;
  onDeleteCourier: (courierId: number, courierName: string) => void;
}

/**
 * Presentation Layer - CourierMobileCard
 * Mobile-first card for couriers and shipping companies.
 * Displays live shipment counts, COD pending amounts, and book balance with 44px touch targets.
 */
export const CourierMobileCard: React.FC<CourierMobileCardProps> = ({
  courier,
  canDeleteParty,
  onOpenManifest,
  onOpenSettle,
  onOpenLedger,
  onEditCourier,
  onDeleteCourier,
}) => {
  const { selection } = useHaptic();

  const balance = Number(courier.balance) || 0;
  const activeShipments = courier.active_shipments_count || 0;

  let statusColor: 'amber' | 'emerald' | 'rose' | 'purple' = 'purple';
  if (activeShipments > 0) {
    statusColor = 'amber';
  } else if (balance > 0) {
    statusColor = 'emerald';
  } else if (balance < 0) {
    statusColor = 'rose';
  }

  return (
    <MobileCard statusColor={statusColor} className="space-y-3">
      {/* 1. Header: Name, Role Badge, and Quick Phone Action */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-black text-ink text-sm leading-tight break-words">
              {courier.name}
            </h4>
            <Badge tone="brand" className="text-2xs px-2 py-0.5 shrink-0">
              شركة شحن
            </Badge>
          </div>

          {courier.notes && (
            <p className="text-xs text-muted font-medium mt-0.5 line-clamp-1">
              {courier.notes}
            </p>
          )}

          {courier.address && (
            <div className="flex items-center gap-1 text-muted text-xs mt-1 truncate">
              <MapPin className="w-3 h-3 text-muted shrink-0" />
              <span className="truncate">{courier.address}</span>
            </div>
          )}
        </div>

        {/* Call Button (44px touch target) */}
        {courier.phone && (
          <a
            href={`tel:${courier.phone}`}
            onClick={() => selection()}
            className="w-11 h-11 rounded-xl bg-ok-soft text-ok border border-ok/30 flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-2xs"
            title={`اتصال بـ ${courier.name}`}
            aria-label={`اتصال بـ ${courier.name}`}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* 2. Metrics Grid: Active Shipments, Pending COD, Book Balance */}
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-surface-2/60 rounded-xl border border-line text-center">
        <div
          onClick={() => {
            if (activeShipments > 0) {
              selection();
              onOpenManifest(courier);
            }
          }}
          className={`p-1.5 rounded-lg transition-all ${
            activeShipments > 0
              ? 'bg-warn-soft border border-warn/30 cursor-pointer active:scale-95'
              : 'bg-panel border border-line'
          }`}
        >
          <span className="text-2xs text-muted font-bold block">الطرود بالعهدة</span>
          <span
            className={`text-xs font-black tabular-nums block mt-0.5 ${
              activeShipments > 0 ? 'text-warn' : 'text-muted'
            }`}
          >
            {activeShipments} طرد
          </span>
        </div>

        <div className="p-1.5 bg-panel rounded-lg border border-line">
          <span className="text-2xs text-muted font-bold block">قيد التحصيل</span>
          <span className="text-xs font-black tabular-nums text-info block mt-0.5">
            {formatCurrency(courier.pending_cod_amount || 0)}
          </span>
        </div>

        <div className="p-1.5 bg-panel rounded-lg border border-line">
          <span className="text-2xs text-muted font-bold block">رصيد الدفاتر</span>
          <span
            className={`text-xs font-black tabular-nums block mt-0.5 ${
              balance > 0
                ? 'text-ok'
                : balance < 0
                ? 'text-bad'
                : 'text-muted'
            }`}
          >
            {formatCurrency(balance)}
          </span>
        </div>
      </div>

      {/* 3. Action Buttons Row (Touch Targets >= 44px) */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-line">
        <button
          type="button"
          onClick={() => {
            selection();
            onOpenManifest(courier);
          }}
          className="min-h-[44px] px-3 py-2 text-xs font-bold text-brand-ink bg-brand-soft hover:bg-brand-soft/80 rounded-xl flex items-center gap-1.5 border border-brand/25 transition-all active:scale-95 cursor-pointer"
          title="كشف البوالص والشحنات التفصيلي (Manifest)"
        >
          <Package className="w-3.5 h-3.5" />
          <span>الشحنات</span>
        </button>

        <button
          type="button"
          onClick={() => {
            selection();
            onOpenSettle(courier);
          }}
          className="min-h-[44px] px-3 py-2 text-xs font-black text-ok bg-ok-soft hover:bg-ok-soft/80 rounded-xl flex items-center gap-1.5 border border-ok/30 transition-all active:scale-95 cursor-pointer"
          title="تصفية واستلام صافي المستحقات"
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-ok" />
          <span>تصفية واستلام</span>
        </button>

        <button
          type="button"
          onClick={() => {
            selection();
            onOpenLedger(courier.id);
          }}
          className="min-h-[44px] px-3 py-2 text-xs font-bold text-ink bg-surface-2 hover:bg-surface-2/80 rounded-xl flex items-center gap-1.5 border border-line transition-all active:scale-95 cursor-pointer"
          title="كشف الحساب المالي التفصيلي"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>كشف الحساب</span>
        </button>

        <button
          type="button"
          onClick={() => {
            selection();
            onEditCourier(courier);
          }}
          className="min-h-[44px] min-w-[44px] p-2.5 text-xs font-bold text-ink bg-surface-2 hover:bg-surface-2/80 rounded-xl flex items-center justify-center border border-line transition-all active:scale-95 cursor-pointer"
          title="تعديل بيانات شركة الشحن"
          aria-label="تعديل بيانات شركة الشحن"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        {canDeleteParty && (
          <button
            type="button"
            onClick={() => {
              selection();
              onDeleteCourier(courier.id, courier.name);
            }}
            className="min-h-[44px] min-w-[44px] p-2.5 text-xs font-bold text-bad bg-bad-soft hover:bg-bad-soft/80 rounded-xl flex items-center justify-center border border-bad/30 transition-all active:scale-95 cursor-pointer"
            title="حذف شركة الشحن"
            aria-label="حذف شركة الشحن"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </MobileCard>
  );
};
