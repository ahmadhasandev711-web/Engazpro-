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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'OWNER':
        return { label: 'مالك / مدير عام', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' };
      case 'MANAGER':
        return { label: 'مدير فرع', bg: 'bg-purple-50 text-purple-800 border-purple-200', dot: 'bg-purple-500' };
      case 'SUPERVISOR':
        return { label: 'مشرف مبيعات', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' };
      case 'CASHIER':
        return { label: 'كاشير نقاط بيع', bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' };
      case 'SALES':
        return { label: 'سيلز / صالة', bg: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500' };
      case 'MANDOB':
        return { label: 'مندوب توزيع', bg: 'bg-teal-50 text-teal-800 border-teal-200', dot: 'bg-teal-500' };
      default:
        return { label: role, bg: 'bg-slate-50 text-slate-800 border-slate-200', dot: 'bg-slate-400' };
    }
  };

  const roleBadge = getRoleBadge(employee.role);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 transition-all duration-200">
      {/* Top Row: Avatar + Name + Role Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={clsx(
              'w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border',
              employee.role === 'ADMIN' || employee.role === 'OWNER'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : employee.role === 'MANDOB'
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : employee.role === 'CASHIER'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : employee.role === 'MANAGER'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            )}
          >
            {employee.name.charAt(0)}
          </div>

          <div className="min-w-0">
            <h4 className="font-black text-slate-900 text-sm truncate leading-snug">
              {employee.name}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              {employee.branch ? (
                <span className="flex items-center gap-1 font-medium text-slate-600 truncate">
                  <Building2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                  {employee.branch.name}
                </span>
              ) : (
                <span className="text-slate-400 font-medium">كل الفروع (مركزي)</span>
              )}
            </div>
          </div>
        </div>

        <span
          className={clsx(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border shrink-0',
            roleBadge.bg
          )}
        >
          <span className={clsx('w-1.5 h-1.5 rounded-full', roleBadge.dot)} />
          {roleBadge.label}
        </span>
      </div>

      {/* Quick Phone Action & Status */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <a
          href={`tel:${employee.phone}`}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-mono text-xs font-bold border border-slate-200 active:scale-95 transition-all"
          dir="ltr"
        >
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          <span>{employee.phone}</span>
        </a>

        {/* Status Toggle Button */}
        {canManage ? (
          <button
            type="button"
            onClick={() => onToggleStatus(employee.id, isActive ? 'INACTIVE' : 'ACTIVE')}
            className={clsx(
              'min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border',
              isActive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            )}
          >
            {isActive ? (
              <UserCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <UserX className="w-4 h-4 text-rose-600" />
            )}
            <span>{isActive ? 'نشط' : 'موقوف'}</span>
          </button>
        ) : (
          <span
            className={clsx(
              'text-xs font-bold px-3 py-1.5 rounded-xl border',
              isActive
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-rose-800 bg-rose-50 border-rose-200'
            )}
          >
            {isActive ? 'نشط' : 'موقوف'}
          </span>
        )}
      </div>

      {/* Today's Performance Pill Strip */}
      <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">مبيعات اليوم</span>
          <span className="font-mono font-bold text-slate-900 block mt-0.5 text-xs truncate">
            {formatCurrency(employee.today_stats?.sales || 0)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">تحصيلات اليوم</span>
          <span className="font-mono font-bold text-teal-700 block mt-0.5 text-xs truncate">
            {formatCurrency(employee.today_stats?.collections || 0)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">الفواتير</span>
          <span className="font-mono font-bold text-slate-700 block mt-0.5 text-xs">
            {employee.today_stats?.invoices_count || 0}
          </span>
        </div>
      </div>

      {/* Actions (44px min-height) */}
      {canManage && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div>
            {employee.is_eligible_for_payroll && onOpenPayroll && (
              <button
                type="button"
                onClick={() => onOpenPayroll(employee)}
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 rounded-xl flex items-center gap-1.5 border border-emerald-200 active:scale-95 transition-all"
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>الراتب والعمولة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(employee)}
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                <span>تعديل</span>
              </button>
            )}
            {isOwnerOrAdmin && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(employee)}
                className="min-h-[44px] px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-xl border border-rose-200 transition-all active:scale-95"
                title="حذف"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
