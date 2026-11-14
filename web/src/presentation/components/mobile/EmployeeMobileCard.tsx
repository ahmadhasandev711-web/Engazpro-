import React from 'react';
import {
  Building2,
  Phone,
  UserCheck,
  UserX,
  Banknote,
  Edit2,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency } from '@pos-mandob/shared';
import { Badge } from '../ui';
import { getEmployeeRoleMeta } from '../employees/employeeRoleMap';

export interface EmployeeItem {
  id: number;
  name: string;
  phone: string;
  email?: string;
  branch_id?: number | null;
  branch?: {
    id: number;
    name: string;
    code: string;
    type?: string;
  } | null;
  role: 'ADMIN' | 'MANDOB' | 'CASHIER' | 'MANAGER' | 'SUPERVISOR' | 'SALES' | 'OWNER';
  status: 'ACTIVE' | 'INACTIVE';
  base_salary?: number;
  commission_type?: 'NONE' | 'PERCENTAGE_OF_SALES' | 'FIXED_PER_INVOICE';
  commission_rate?: number;
  is_eligible_for_payroll?: boolean;
  created_at: string;
  today_stats: {
    sales: number;
    invoices_count: number;
    collections: number;
  };
}

interface EmployeeMobileCardProps {
  employee: EmployeeItem;
  canManage: boolean;
  isOwnerOrAdmin: boolean;
  onToggleStatus: (id: number, newStatus: 'ACTIVE' | 'INACTIVE') => void;
  onOpenPayroll?: (employee: EmployeeItem) => void;
  onEdit?: (employee: EmployeeItem) => void;
  onDelete?: (employee: EmployeeItem) => void;
}

export const EmployeeMobileCard: React.FC<EmployeeMobileCardProps> = ({
  employee,
  canManage,
  isOwnerOrAdmin,
  onToggleStatus,
  onOpenPayroll,
  onEdit,
  onDelete,
}) => {
  const isActive = employee.status === 'ACTIVE';
  const roleMeta = getEmployeeRoleMeta(employee.role);

  return (
    <div className="bg-panel text-ink rounded-2xl border border-line p-4 shadow-xs space-y-3 transition-colors duration-200">
      {/* Top Row: Avatar + Name + Role Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={clsx(
              'w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border',
              roleMeta.avatarClass
            )}
          >
            {employee.name.charAt(0)}
          </div>

          <div className="min-w-0">
            <h4 className="font-black text-ink text-sm truncate leading-snug">
              {employee.name}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
              {employee.branch ? (
                <span className="flex items-center gap-1 font-medium text-muted truncate">
                  <Building2 className="w-3.5 h-3.5 text-brand shrink-0" />
                  {employee.branch.name}
                </span>
              ) : (
                <span className="text-muted font-medium">كل الفروع (مركزي)</span>
              )}
            </div>
          </div>
        </div>

        <Badge tone={roleMeta.tone} dot className="shrink-0">
          {roleMeta.label}
        </Badge>
      </div>

      {/* Quick Phone Action & Status */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <a
          href={`tel:${employee.phone}`}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-ink tabular-nums text-xs font-bold border border-line active:scale-95 transition-all"
          dir="ltr"
        >
          <Phone className="w-3.5 h-3.5 text-muted" />
          <span>{employee.phone}</span>
        </a>

        {/* Status Toggle Button */}
        {canManage ? (
          <button
            type="button"
            onClick={() => onToggleStatus(employee.id, isActive ? 'INACTIVE' : 'ACTIVE')}
            className={clsx(
              'min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border cursor-pointer',
              isActive
                ? 'bg-ok-soft text-ok border-ok/30 hover:bg-ok-soft/80'
                : 'bg-bad-soft text-bad border-bad/30 hover:bg-bad-soft/80'
            )}
          >
            {isActive ? (
              <UserCheck className="w-4 h-4 text-ok" />
            ) : (
              <UserX className="w-4 h-4 text-bad" />
            )}
            <span>{isActive ? 'نشط' : 'موقوف'}</span>
          </button>
        ) : (
          <Badge tone={isActive ? 'ok' : 'bad'} className="px-3 py-1.5 rounded-xl">
            {isActive ? 'نشط' : 'موقوف'}
          </Badge>
        )}
      </div>

      {/* Today's Performance Pill Strip */}
      <div className="grid grid-cols-3 gap-1.5 p-2 bg-surface-2/60 rounded-xl border border-line text-center text-xs">
        <div>
          <span className="text-2xs text-muted block font-medium">مبيعات اليوم</span>
          <span className="tabular-nums font-bold text-ink block mt-0.5 text-xs truncate">
            {formatCurrency(employee.today_stats?.sales || 0)}
          </span>
        </div>
        <div>
          <span className="text-2xs text-muted block font-medium">تحصيلات اليوم</span>
          <span className="tabular-nums font-bold text-ok block mt-0.5 text-xs truncate">
            {formatCurrency(employee.today_stats?.collections || 0)}
          </span>
        </div>
        <div>
          <span className="text-2xs text-muted block font-medium">الفواتير</span>
          <span className="tabular-nums font-bold text-ink block mt-0.5 text-xs">
            {employee.today_stats?.invoices_count || 0}
          </span>
        </div>
      </div>

      {/* Actions (44px min-height) */}
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
          <div>
            {employee.is_eligible_for_payroll && onOpenPayroll && (
              <button
                type="button"
                onClick={() => onOpenPayroll(employee)}
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-ok bg-ok-soft hover:bg-ok-soft/80 rounded-xl flex items-center gap-1.5 border border-ok/30 active:scale-95 transition-all cursor-pointer"
              >
                <Banknote className="w-4 h-4 text-ok" />
                <span>الراتب والعمولة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(employee)}
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-ink bg-surface-2 hover:bg-surface-2/80 rounded-xl flex items-center gap-1.5 border border-line transition-all active:scale-95 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-muted" />
                <span>تعديل</span>
              </button>
            )}
            {isOwnerOrAdmin && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(employee)}
                className="min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-bold text-bad bg-bad-soft hover:bg-bad-soft/80 rounded-xl border border-bad/30 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                title="حذف"
                aria-label="حذف"
              >
                <Trash2 className="w-4 h-4 text-bad" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
