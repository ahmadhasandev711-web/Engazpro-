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

  // Status color stripe
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
            <h4 className="font-black text-slate-900 text-sm leading-tight break-words">
              {courier.name}
            </h4>
            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200 shrink-0">
              شركة شحن
            </span>
          </div>

          {courier.notes && (
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 line-clamp-1">
              {courier.notes}
            </p>
          )}

          {courier.address && (
            <div className="flex items-center gap-1 text-slate-500 text-[11px] mt-1 truncate">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{courier.address}</span>
            </div>
          )}
        </div>

        {/* Call Button (44px touch target) */}
        {courier.phone && (
          <a
            href={`tel:${courier.phone}`}
            onClick={() => selection()}
            className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-2xs"
            title={`اتصال بـ ${courier.name}`}
            aria-label={`اتصال بـ ${courier.name}`}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* 2. Metrics Grid: Active Shipments, Pending COD, Book Balance */}
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-center">
        {/* Active Shipments */}
        <div
          onClick={() => {
            if (activeShipments > 0) {
              selection();
              onOpenManifest(courier);
            }
          }}
          className={`p-1.5 rounded-lg transition-all ${
            activeShipments > 0
              ? 'bg-amber-50 border border-amber-200/80 cursor-pointer active:scale-95'
              : 'bg-white border border-slate-100'
          }`}
        >
          <span className="text-[10px] text-slate-400 font-bold block">الطرود بالعهدة</span>
          <span
            className={`text-xs font-black font-mono block mt-0.5 ${
              activeShipments > 0 ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            {activeShipments} طرد
          </span>
        </div>

        {/* Pending COD */}
        <div className="p-1.5 bg-white rounded-lg border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold block">قيد التحصيل</span>
          <span className="text-xs font-black font-mono text-blue-700 block mt-0.5">
            {formatCurrency(courier.pending_cod_amount || 0)}
          </span>
        </div>

        {/* Book Balance */}
        <div className="p-1.5 bg-white rounded-lg border border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold block">رصيد الدفاتر</span>
          <span
            className={`text-xs font-black font-mono block mt-0.5 ${
              balance > 0
                ? 'text-emerald-700'
                : balance < 0
                ? 'text-rose-700'
                : 'text-slate-500'
            }`}
          >
            {formatCurrency(balance)}
          </span>
        </div>
      </div>

      {/* 3. Action Buttons Row (Touch Targets >= 44px) */}
      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
        {/* Manifest Button */}
        <button
          type="button"
          onClick={() => {
            selection();
            onOpenManifest(courier);
          }}
          className="min-h-[42px] px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 rounded-xl flex items-center gap-1.5 border border-purple-200 transition-all active:scale-95 cursor-pointer"
          title="كشف البوالص والشحنات التفصيلي (Manifest)"
        >
          <Package className="w-3.5 h-3.5" />
          <span>الشحنات</span>
        </button>

        {/* Settle Net Balance Button */}
        <button
          type="button"
          onClick={() => {
            selection();
            onOpenSettle(courier);
          }}
          className="min-h-[42px] px-3 py-2 text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 rounded-xl flex items-center gap-1.5 border border-emerald-200 transition-all active:scale-95 cursor-pointer"
          title="تصفية واستلام صافي المستحقات"
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
          <span>تصفية واستلام</span>
        </button>

        {/* Ledger Button */}
        <button
          type="button"
          onClick={() => {
            selection();
            onOpenLedger(courier.id);
          }}
          className="min-h-[42px] px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95 cursor-pointer"
          title="كشف الحساب المالي التفصيلي"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>كشف الحساب</span>
        </button>

        {/* Edit Button */}
        <button
          type="button"
          onClick={() => {
            selection();
            onEditCourier(courier);
          }}
          className="min-h-[42px] p-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 cursor-pointer"
          title="تعديل بيانات شركة الشحن"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        {/* Delete Button */}
        {canDeleteParty && (
          <button
            type="button"
            onClick={() => {
              selection();
              onDeleteCourier(courier.id, courier.name);
            }}
            className="min-h-[42px] p-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl flex items-center justify-center border border-rose-200 transition-all active:scale-95 cursor-pointer"
            title="حذف شركة الشحن"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </MobileCard>
  );
};
