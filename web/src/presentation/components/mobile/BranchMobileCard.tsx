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
import { Badge, Button, Card } from '../ui';

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
          <Badge tone="ok" className="py-1 rounded-xl font-bold gap-1">
            <Store className="w-3.5 h-3.5" />
            معرض بيع
          </Badge>
        );
      case 'WAREHOUSE':
        return (
          <Badge tone="warn" className="py-1 rounded-xl font-bold gap-1">
            <Warehouse className="w-3.5 h-3.5" />
            مستودع رئيسي
          </Badge>
        );
      case 'VAN':
        return (
          <Badge tone="info" className="py-1 rounded-xl font-bold gap-1">
            <Truck className="w-3.5 h-3.5" />
            سيارة مندوب
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="p-4 sm:p-4 space-y-3">
      {/* Header: Name, Main Branch Tag, Type Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-black text-ink text-base leading-snug truncate">
              {branch.name}
            </h3>
            {branch.is_main && (
              <Badge tone="warn" className="rounded-lg text-2xs font-black">
                الفرع الرئيسي
              </Badge>
            )}
          </div>
          <span className="text-2xs tabular-nums font-bold text-muted">
            كود: {branch.code}
          </span>
        </div>

        <div className="shrink-0">{getTypeBadge(branch.type)}</div>
      </div>

      {/* Address & Phone */}
      {(branch.address || branch.phone) && (
        <div className="space-y-1.5 text-xs text-muted bg-surface-2/70 p-2.5 rounded-xl border border-line">
          {branch.address && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
              <span className="truncate text-ink">{branch.address}</span>
            </div>
          )}
          {branch.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
              <a
                href={`tel:${branch.phone}`}
                className="tabular-nums text-ok hover:underline active:opacity-75 font-bold"
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
        <div className="bg-surface-2 p-2 rounded-xl text-center border border-line flex items-center justify-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="text-muted font-medium">فريق العمل:</span>
          <span className="font-black text-ink tabular-nums">{branch.users_count || 0}</span>
        </div>
        <div className="bg-surface-2 p-2 rounded-xl text-center border border-line flex items-center justify-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="text-muted font-medium">الأصناف:</span>
          <span className="font-black text-ink tabular-nums">{branch.stocks_count || 0}</span>
        </div>
      </div>

      {/* Actions: Minimum 44px touch targets */}
      <div className="pt-2 border-t border-line flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => onOpenInventory(branch)}
          leftIcon={<Package className="w-4 h-4 text-ok" />}
          className="flex-1 bg-ok-soft hover:bg-ok/15 text-ok border-ok/25 text-xs"
        >
          <span>جرد المخزون</span>
        </Button>

        {isOwnerOrManager && (
          <>
            {onEdit && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => onEdit(branch)}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                className="px-3.5 text-xs"
                title="تعديل الفرع"
              >
                <span>تعديل</span>
              </Button>
            )}

            {!branch.is_main && onDelete && (
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={() => onDelete(branch.id, branch.name)}
                className="min-w-[44px] px-3 bg-bad-soft hover:bg-bad/15 text-bad border border-bad/25"
                title="حذف الفرع"
                aria-label="حذف الفرع"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
