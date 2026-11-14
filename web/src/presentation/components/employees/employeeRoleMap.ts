import type { BadgeTone } from '../ui/Badge';

export type EmployeeRole =
  | 'ADMIN'
  | 'OWNER'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'SALES'
  | 'MANDOB';

export interface EmployeeRoleMeta {
  label: string;
  tone: BadgeTone;
  avatarClass: string;
}

const EMPLOYEE_ROLE_MAP: Record<EmployeeRole, EmployeeRoleMeta> = {
  OWNER: {
    label: 'مالك / مدير عام',
    tone: 'ok',
    avatarClass: 'bg-ok-soft text-ok border-ok/30',
  },
  ADMIN: {
    label: 'مدير نظام (شريك)',
    tone: 'ok',
    avatarClass: 'bg-ok-soft text-ok border-ok/30',
  },
  MANAGER: {
    label: 'مدير فرع',
    tone: 'brand',
    avatarClass: 'bg-brand-soft text-brand-ink border-brand/30',
  },
  SUPERVISOR: {
    label: 'مشرف ورديات',
    tone: 'info',
    avatarClass: 'bg-info-soft text-info border-info/30',
  },
  CASHIER: {
    label: 'كاشير POS',
    tone: 'warn',
    avatarClass: 'bg-warn-soft text-warn border-warn/30',
  },
  SALES: {
    label: 'بائع صالة / سيلز',
    tone: 'info',
    avatarClass: 'bg-info-soft text-info border-info/30',
  },
  MANDOB: {
    label: 'مندوب مبيعات',
    tone: 'brand',
    avatarClass: 'bg-brand-soft text-brand-ink border-brand/30',
  },
};

export function getEmployeeRoleMeta(role: string): EmployeeRoleMeta {
  if (role in EMPLOYEE_ROLE_MAP) {
    return EMPLOYEE_ROLE_MAP[role as EmployeeRole];
  }
  return {
    label: role,
    tone: 'neutral',
    avatarClass: 'bg-surface-2 text-muted border-line',
  };
}
