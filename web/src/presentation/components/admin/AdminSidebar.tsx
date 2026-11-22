import React from 'react';
import {
  Activity,
  Boxes,
  FileText,
  Globe,
  Key,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Badge } from '../ui';

export type AdminSectionId =
  | 'overview'
  | 'easyfy-orders'
  | 'easyfy-catalog'
  | 'easyfy-inventory'
  | 'easyfy-config'
  | 'users'
  | 'licenses'
  | 'inquiries'
  | 'system'
  | 'audit';

export interface AdminSidebarCounts {
  pendingProofs: number;
  pendingOrders: number;
  lowStockVariants: number;
  merchants: number;
  unusedLicenses: number;
  newInquiries: number;
  systemAlerts: number;
}

interface AdminSidebarProps {
  activeSection: AdminSectionId;
  onSelectSection: (section: AdminSectionId) => void;
  counts: AdminSidebarCounts;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItemConfig {
  id: AdminSectionId;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  badgeTone?: 'bad' | 'warn' | 'brand' | 'info' | 'neutral';
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSelectSection,
  counts,
  mobileOpen,
  onCloseMobile,
}) => {
  const groups: Array<{ title: string; items: NavItemConfig[] }> = [
    {
      title: 'مركز القيادة',
      items: [
        {
          id: 'overview',
          label: 'لوحة القيادة والأرباح',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'متجر Easyfy Supplies',
      items: [
        {
          id: 'easyfy-orders',
          label: 'الطلبات والتحويلات',
          icon: <ShoppingBag className="w-4 h-4" />,
          badgeCount: counts.pendingProofs > 0 ? counts.pendingProofs : counts.pendingOrders,
          badgeTone: counts.pendingProofs > 0 ? 'bad' : 'warn',
        },
        {
          id: 'easyfy-catalog',
          label: 'المنتجات والأقسام',
          icon: <Package className="w-4 h-4" />,
        },
        {
          id: 'easyfy-inventory',
          label: 'المخزون والطلب',
          icon: <Boxes className="w-4 h-4" />,
          badgeCount: counts.lowStockVariants,
          badgeTone: 'warn',
        },
        {
          id: 'easyfy-config',
          label: 'الكوبونات والشحن والدفع',
          icon: <Settings className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'إدارة منصة SaaS',
      items: [
        {
          id: 'users',
          label: 'المتاجر المشتركة',
          icon: <Users className="w-4 h-4" />,
          badgeCount: counts.merchants,
          badgeTone: 'neutral',
        },
        {
          id: 'licenses',
          label: 'الأكواد والتسعير',
          icon: <Key className="w-4 h-4" />,
          badgeCount: counts.unusedLicenses,
          badgeTone: 'brand',
        },
        {
          id: 'inquiries',
          label: 'طلبات المتاجر',
          icon: <Globe className="w-4 h-4" />,
          badgeCount: counts.newInquiries,
          badgeTone: 'info',
        },
        {
          id: 'system',
          label: 'صحة النظام والطابور',
          icon: <Activity className="w-4 h-4" />,
          badgeCount: counts.systemAlerts,
          badgeTone: 'bad',
        },
        {
          id: 'audit',
          label: 'سجل التدقيق السيادي',
          icon: <FileText className="w-4 h-4" />,
        },
      ],
    },
  ];

  const handleSelect = (id: AdminSectionId) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const navBody = (
    <div className="space-y-6 p-4">
      {groups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <p className="px-3 text-[11px] font-extrabold text-muted uppercase tracking-wider">
            {group.title}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    'w-full min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-2 transition-colors text-right',
                    isActive
                      ? 'bg-brand text-on-brand shadow-xs'
                      : 'text-ink hover:bg-surface-2'
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={cn('shrink-0', isActive ? 'text-on-brand' : 'text-muted')}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                    <Badge
                      tone={isActive ? 'neutral' : item.badgeTone || 'neutral'}
                      className={cn(
                        'text-[11px] px-2 py-0 tabular-nums shrink-0',
                        isActive && 'bg-panel text-ink border-transparent'
                      )}
                    >
                      {item.badgeCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-72 shrink-0 bg-panel border border-line rounded-2xl self-start sticky top-20 shadow-2xs">
        {navBody}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-ink/50 backdrop-blur-sm flex"
          onClick={onCloseMobile}
          dir="rtl"
        >
          <aside
            className="w-72 max-w-[85vw] h-full bg-panel border-l border-line overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <span className="font-black text-sm text-ink">أقسام الإدارة العامة</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted hover:text-ink"
                aria-label="إغلاق القائمة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {navBody}
          </aside>
        </div>
      )}
    </>
  );
};
