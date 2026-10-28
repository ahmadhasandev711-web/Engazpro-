import { useMemo } from 'react';
import {
  LayoutDashboard,
  Store,
  Receipt,
  Coins,
  Wallet,
  Users,
  Landmark,
  LucideIcon,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export interface MobileNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

/**
 * Application Layer - useMobileNavigation Hook
 * Conforms to OCP (GR-6) & OOP/Enums (GR-8)
 * Supplies role-tailored mobile bottom navigation items.
 */
export const useMobileNavigation = () => {
  const { isCashier, isMandob, isOwnerOrAdmin, isManager } = usePermissions();

  const navItems = useMemo<MobileNavItem[]>(() => {
    // Strategy 1: Cashier (POS & Shift centric)
    if (isCashier) {
      return [
        { to: '/dashboard', label: 'الوردية', icon: LayoutDashboard },
        { to: '/pos', label: 'كاشير POS', icon: Store },
        { to: '/sales', label: 'فواتيري', icon: Receipt },
        { to: '/expenses', label: 'المصروفات', icon: Coins },
      ];
    }

    // Strategy 2: Mandob (Field distribution & collection centric)
    if (isMandob) {
      return [
        { to: '/dashboard', label: 'دفتري', icon: LayoutDashboard },
        { to: '/pos', label: 'بيع جديد', icon: Store },
        { to: '/payments', label: 'التحصيل', icon: Wallet },
        { to: '/customers', label: 'العملاء', icon: Users },
      ];
    }

    // Strategy 3: Owner / Admin / Manager (Executive & Oversight centric)
    if (isOwnerOrAdmin || isManager) {
      return [
        { to: '/dashboard', label: 'المؤشرات', icon: LayoutDashboard },
        { to: '/sales', label: 'المبيعات', icon: Receipt },
        { to: '/treasuries', label: 'الورديات والخزن', icon: Landmark },
      ];
    }

    // Fallback default
    return [
      { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
      { to: '/sales', label: 'المبيعات', icon: Receipt },
      { to: '/payments', label: 'التحصيل', icon: Wallet },
      { to: '/expenses', label: 'المصروفات', icon: Coins },
    ];
  }, [isCashier, isMandob, isOwnerOrAdmin, isManager]);

  return { navItems };
};
