import React, { useState, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  FileSpreadsheet,
  LogOut,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Landmark,
  Menu,
  X,
  Store,
  Building2,
  ArrowLeftRight,
  ShoppingBag,
  Globe,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '../../data/store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils/cn';
import { ActiveShiftBanner } from './shifts/ActiveShiftBanner';
import { OfflineBanner } from './pwa/OfflineBanner';
import { PWAInstallButton } from './pwa/PWAInstallButton';
import { MobileBottomNav } from './MobileBottomNav';
import { AppErrorBoundary } from './common/AppErrorBoundary';

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ElementType;
}

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const {
    isOwner,
    isOwnerOrAdmin,
    isMandob,
    isCashier,
    isManager,
    isSupervisor,
    canViewTreasuries,
    canCreatePurchases,
    canManageSuppliers,
    canManageEmployees,
    canManageSettings,
    canViewProfitReport,
  } = usePermissions();

  // Group 1: البيع (الرئيسية، نقطة البيع، طلبات المتجر، المناديب والشحن)
  const salesGroup: NavItemDef[] = [
    { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { to: '/pos', label: 'نقطة البيع (POS)', icon: Store },
    {
      to: '/wc-orders',
      label: isMandob ? 'طلبات التوصيل والشحن' : 'طلبات المتجر (الشحن)',
      icon: ShoppingBag,
    },
    { to: '/couriers', label: 'شركات الشحن', icon: Truck },
  ];

  // Group 2: المخزون (الأصناف، التحويلات، الفروع)
  const inventoryGroup: NavItemDef[] = [
    { to: '/products', label: isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون', icon: Package },
    ...(isOwner || isManager
      ? [{ to: '/transfers', label: 'تحويلات المخزون', icon: ArrowLeftRight }]
      : []),
    ...(isOwnerOrAdmin
      ? [{ to: '/branches', label: 'الفروع والمخازن', icon: Building2 }]
      : []),
  ];

  // Group 3: الحسابات (الخزن، العملاء والموردين، الفواتير، السندات، المصروفات، الموظفين، التقارير)
  const accountsGroup: NavItemDef[] = [
    ...(canViewTreasuries ? [{ to: '/treasuries', label: 'الخزن والورديات', icon: Landmark }] : []),
    { to: '/customers', label: 'العملاء', icon: Users },
    ...(canManageSuppliers ? [{ to: '/suppliers', label: 'الموردين', icon: Building2 }] : []),
    { to: '/sales', label: 'المبيعات', icon: Receipt },
    ...(canCreatePurchases ? [{ to: '/purchases', label: 'المشتريات', icon: Receipt }] : []),
    { to: '/payments', label: isOwner ? 'السندات (قبض وصرف)' : 'سندات القبض (التحصيل)', icon: Wallet },
    {
      to: '/expenses',
      label: isMandob ? 'مصاريف خط السير' : isCashier ? 'مصروفات الدرج' : 'المصروفات',
      icon: Wallet,
    },
    ...(canManageEmployees ? [{ to: '/employees', label: 'فريق العمل والمناديب', icon: UserCheck }] : []),
    ...(canViewProfitReport || isManager
      ? [{ to: '/reports', label: isOwner ? 'التقارير والأرباح' : 'التقارير والمبيعات', icon: BarChart3 }]
      : []),
  ];

  // Bottom Group: الإعدادات والنظام (الإعدادات، ربط ووكومرس، استيراد وتصدير Excel، لوحة الإدارة)
  const bottomGroup: NavItemDef[] = [
    ...(canManageSettings ? [{ to: '/settings', label: 'الإعدادات والاشتراك', icon: Settings }] : []),
    ...(isOwnerOrAdmin ? [{ to: '/woocommerce', label: 'ربط WooCommerce', icon: Globe }] : []),
    ...(isOwner || isManager ? [{ to: '/excel', label: 'استيراد وتصدير Excel', icon: FileSpreadsheet }] : []),
    ...(user?.is_admin
      ? [{ to: '/admin-dashboard', label: '👑 لوحة تحكم الإدارة', icon: ShieldCheck }]
      : []),
  ];

  const subscription = user?.subscription;
  const isSubscriptionValid = subscription?.is_valid ?? true;
  const daysRemaining = subscription?.days_remaining ?? 365;

  const roleTitle = isOwner
    ? 'صاحب العمل (المالك)'
    : isManager
    ? 'مدير الفرع'
    : isSupervisor
    ? 'مشرف ورديات'
    : isMandob
    ? 'مندوب مبيعات'
    : 'كاشير POS';

  const renderNavLinks = (items: NavItemDef[], onClickItem?: () => void) => (
    <div className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClickItem}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors select-none',
                isActive
                  ? 'bg-brand-soft text-brand-ink font-bold shadow-2xs'
                  : 'text-muted hover:bg-surface-2 hover:text-ink'
              )
            }
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-canvas font-sans text-ink antialiased overflow-hidden" dir="rtl">
      {/* Offline Alert Banner */}
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar (lg and above) */}
        <aside className="hidden lg:flex w-64 bg-panel border-l border-line flex-col shadow-2xs select-none">
          {/* App Branding */}
          <div className="h-16 flex items-center px-6 border-b border-line flex-shrink-0">
            <Link to="/dashboard" className="flex items-center gap-1.5 group">
              <span className="font-black text-xl tracking-tighter text-ink font-sans flex items-center">
                Engaz<span className="text-brand">.</span>
                <span className="mr-1.5 text-2xs font-black bg-brand-soft text-brand-ink border border-brand/20 px-1.5 py-0.5 rounded-md shadow-2xs">
                  PRO
                </span>
              </span>
              <span className="text-xs font-bold text-muted border-r border-line pr-2 mr-1">
                إنجاز برو
              </span>
            </Link>
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            {/* 1. قسم البيع */}
            <div>
              <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                البيع والتشغيل
              </p>
              {renderNavLinks(salesGroup)}
            </div>

            {/* 2. قسم المخزون */}
            <div>
              <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                المخزون والفروع
              </p>
              {renderNavLinks(inventoryGroup)}
            </div>

            {/* 3. قسم الحسابات والمالية */}
            <div>
              <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                الحسابات والمالية
              </p>
              {renderNavLinks(accountsGroup)}
            </div>

            {/* 4. الإعدادات والنظام */}
            {bottomGroup.length > 0 && (
              <div className="pt-2 border-t border-line">
                <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                  الإعدادات والنظام
                </p>
                {renderNavLinks(bottomGroup)}
              </div>
            )}
          </nav>

          {/* Desktop Sidebar Footer */}
          <div className="p-3 border-t border-line bg-surface-2/40 space-y-2 flex-shrink-0">
            <PWAInstallButton variant="sidebar" />

            {isOwner ? (
              <div className="flex items-center justify-between text-xs text-muted px-1">
                <span className="font-medium">الاشتراك:</span>
                <span
                  className={cn(
                    'font-bold px-2 py-0.5 rounded-full text-xs',
                    isSubscriptionValid
                      ? 'text-ok bg-ok-soft'
                      : 'text-bad bg-bad-soft'
                  )}
                >
                  {isSubscriptionValid ? `نشط (${daysRemaining} يوم)` : 'منتهي الصلاحية'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-muted px-1">
                <span className="font-medium">الحساب:</span>
                <span className="font-bold px-2 py-0.5 rounded-full text-xs text-brand-ink bg-brand-soft border border-brand/20">
                  {roleTitle}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-ink truncate max-w-[140px]">
                {user?.name || 'مستخدم النظام'}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                title="تسجيل الخروج"
                className="text-muted hover:text-bad p-1 rounded-lg transition-colors focus:outline-none"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-Out Drawer (lg:hidden) */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Slide Panel */}
            <aside className="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-panel border-l border-line shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="h-16 flex items-center justify-between px-5 border-b border-line bg-surface-2/50 flex-shrink-0">
                <Link to="/dashboard" onClick={() => setIsMobileDrawerOpen(false)} className="flex items-center gap-1.5">
                  <span className="font-black text-lg tracking-tighter text-ink font-sans flex items-center">
                    Engaz<span className="text-brand">.</span>
                    <span className="mr-1 text-2xs font-black bg-brand-soft text-brand-ink border border-brand/20 px-1.5 py-0.5 rounded-md">
                      PRO
                    </span>
                  </span>
                  <span className="text-xs font-bold text-muted border-r border-line pr-1.5 mr-1">
                    إنجاز برو
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 text-muted hover:text-ink rounded-xl hover:bg-surface-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                    البيع والتشغيل
                  </p>
                  {renderNavLinks(salesGroup, () => setIsMobileDrawerOpen(false))}
                </div>

                <div>
                  <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                    المخزون والفروع
                  </p>
                  {renderNavLinks(inventoryGroup, () => setIsMobileDrawerOpen(false))}
                </div>

                <div>
                  <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                    الحسابات والمالية
                  </p>
                  {renderNavLinks(accountsGroup, () => setIsMobileDrawerOpen(false))}
                </div>

                {bottomGroup.length > 0 && (
                  <div className="pt-2 border-t border-line">
                    <p className="text-[11px] font-bold text-muted/80 uppercase px-3 pb-1 tracking-wider">
                      الإعدادات والنظام
                    </p>
                    {renderNavLinks(bottomGroup, () => setIsMobileDrawerOpen(false))}
                  </div>
                )}
              </nav>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-line bg-surface-2/50 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex-shrink-0">
                <PWAInstallButton variant="sidebar" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-ink truncate max-w-[150px]">
                      {user?.name || 'مستخدم النظام'}
                    </p>
                    <span className="text-2xs text-muted">{roleTitle}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 text-xs text-bad bg-bad-soft hover:opacity-90 px-3 py-1.5 rounded-xl font-bold transition-opacity"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>خروج</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Grace Period / Expiration Notice Banner */}
          {!isSubscriptionValid && (
            <div className="bg-bad text-on-brand px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-bold shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>اشتراكك منتهي الصلاحية. يرجى تجديد الاشتراك السنوي لمتابعة العمليات.</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="bg-panel text-bad px-3 py-1 rounded-md text-xs font-black hover:bg-surface-2 flex-shrink-0 transition-colors"
              >
                تجديد الآن
              </button>
            </div>
          )}

          {/* Top Header */}
          <header className="h-16 bg-panel border-b border-line px-4 sm:px-6 flex items-center justify-between shadow-2xs z-10 flex-shrink-0 select-none">
            {/* Left/Right Header Area */}
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="p-2 -mr-2 text-muted hover:text-ink hover:bg-surface-2 rounded-xl lg:hidden focus:outline-none"
                title="القائمة"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Mobile App Branding */}
              <Link to="/dashboard" className="flex items-center gap-1.5 lg:hidden">
                <span className="font-black text-base tracking-tighter text-ink font-sans flex items-center">
                  Engaz<span className="text-brand">.</span>
                  <span className="mr-1 text-2xs font-black bg-brand-soft text-brand-ink border border-brand/20 px-1.5 py-0.5 rounded-md">
                    PRO
                  </span>
                </span>
              </Link>

              {/* Greeting & Role on Tablet & Desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium text-muted">
                  مرحباً، <strong className="text-ink">{user?.name || 'المستخدم'}</strong>
                  {isOwner && (
                    <span className="mr-2 text-xs bg-brand-soft text-brand-ink px-2.5 py-0.5 rounded-full font-bold border border-brand/20">
                      صاحب العمل
                    </span>
                  )}
                  {isManager && (
                    <span className="mr-2 text-xs bg-surface-2 text-ink px-2.5 py-0.5 rounded-full font-bold border border-line">
                      مدير الفرع
                    </span>
                  )}
                  {isSupervisor && (
                    <span className="mr-2 text-xs bg-info-soft text-info px-2.5 py-0.5 rounded-full font-bold border border-info/20">
                      مشرف ورديات
                    </span>
                  )}
                  {isMandob && (
                    <span className="mr-2 text-xs bg-brand-soft text-brand-ink px-2.5 py-0.5 rounded-full font-bold border border-brand/20">
                      مندوب مبيعات
                    </span>
                  )}
                  {isCashier && (
                    <span className="mr-2 text-xs bg-warn-soft text-warn px-2.5 py-0.5 rounded-full font-bold border border-warn/20">
                      كاشير POS
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2.5">
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                title={resolvedTheme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-surface-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-4 h-4 text-warn" />
                ) : (
                  <Moon className="w-4 h-4 text-muted" />
                )}
              </button>

              {/* PWA Install Button */}
              <PWAInstallButton variant="header" />

              {/* Online Connection Badge */}
              <span className="text-xs bg-ok-soft text-ok border border-ok/20 px-2.5 sm:px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
                <span className="hidden sm:inline">الخادم متصل</span>
              </span>
            </div>
          </header>

          {/* Page View with Responsive Bottom Padding for Mobile Nav */}
          <main className="flex-1 overflow-y-auto p-2.5 sm:p-6 bg-canvas pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
            <ActiveShiftBanner />
            <Suspense
              fallback={
                <div className="w-full py-16 flex flex-col items-center justify-center text-center animate-in fade-in duration-150" dir="rtl">
                  <div className="w-8 h-8 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
                  <span className="mt-3 text-xs font-bold text-muted font-sans">جاري فتح الصفحة...</span>
                </div>
              }
            >
              <AppErrorBoundary key={location.pathname}>
                <Outlet />
              </AppErrorBoundary>
            </Suspense>
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <MobileBottomNav onOpenDrawer={() => setIsMobileDrawerOpen(true)} />
        </div>
      </div>
    </div>
  );
};
