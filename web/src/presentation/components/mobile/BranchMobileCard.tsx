import React from 'react';
import {
  Store,
  Warehouse,
  Truck,
  MapPin,
  Phone,
  Package,
  Edit2,
  Trash2,
  Users,
} from 'lucide-react';

interface BranchMobileCardProps {
  branch: any;
  isOwnerOrManager?: boolean;
  onOpenInventory: (branch: any) => void;
  onEdit?: (branch: any) => void;
  onDelete?: (id: number, name: string) => void;
}

export const BranchMobileCard: React.FC<BranchMobileCardProps> = ({
  branch,
  isOwnerOrManager = false,
  onOpenInventory,
  onEdit,
  onDelete,
}) => {
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'STORE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Store className="w-3.5 h-3.5 text-emerald-600" />
            معرض بيع
          </span>
        );
      case 'WAREHOUSE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Warehouse className="w-3.5 h-3.5 text-amber-600" />
            مستودع رئيسي
          </span>
        );
      case 'VAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <Truck className="w-3.5 h-3.5 text-sky-600" />
            سيارة مندوب
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 transition-all duration-200">
      {/* Header: Name, Main Branch Tag, Type Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-black text-slate-900 text-base leading-snug truncate">
              {branch.name}
            </h3>
            {branch.is_main && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                الفرع الرئيسي
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-400">
            كود: {branch.code}
          </span>
        </div>

        <div className="shrink-0">{getTypeBadge(branch.type)}</div>
      </div>

      {/* Address & Phone */}
      {(branch.address || branch.phone) && (
        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
          {branch.address && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{branch.address}</span>
            </div>
          )}
          {branch.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <a
                href={`tel:${branch.phone}`}
                className="font-mono text-emerald-700 hover:underline active:opacity-75 font-bold"
                dir="ltr"
              >
                {branch.phone}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Sub-stats: Staff & Stock Items */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100 flex items-center justify-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 font-medium">فريق العمل:</span>
          <span className="font-black text-slate-800">{branch.users_count || 0}</span>
        </div>
        <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100 flex items-center justify-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 font-medium">الأصناف:</span>
          <span className="font-black text-slate-800">{branch.stocks_count || 0}</span>
        </div>
      </div>

      {/* Actions: Minimum 44px touch targets */}
      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenInventory(branch)}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all active:scale-95"
        >
          <Package className="w-4 h-4 text-emerald-600" />
          <span>جرد المخزون</span>
        </button>

        {isOwnerOrManager && (
          <>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(branch)}
                className="min-h-[44px] px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95"
                title="تعديل الفرع"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                <span>تعديل</span>
              </button>
            )}

            {!branch.is_main && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(branch.id, branch.name)}
                className="min-h-[44px] px-3 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1 border border-rose-200 transition-all active:scale-95"
                title="حذف الفرع"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
