import React, { useState, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
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
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../data/store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { ActiveShiftBanner } from './shifts/ActiveShiftBanner';
import { OfflineBanner } from './pwa/OfflineBanner';
import { PWAInstallButton } from './pwa/PWAInstallButton';
import { MobileBottomNav } from './MobileBottomNav';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
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

  const navItems = [
    { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { to: '/pos', label: 'نقطة البيع (POS)', icon: Store },
    { to: '/products', label: isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون', icon: Package },
    { to: '/sales', label: 'المبيعات', icon: Receipt },
    ...(canCreatePurchases ? [{ to: '/purchases', label: 'المشتريات', icon: Receipt }] : []),
    { to: '/payments', label: isOwner ? 'السندات (قبض وصرف)' : 'سندات القبض (التحصيل)', icon: Wallet },
    { to: '/customers', label: 'العملاء', icon: Users },
    ...(canManageSuppliers ? [{ to: '/suppliers', label: 'الموردين', icon: Building2 }] : []),
    { to: '/couriers', label: 'شركات الشحن', icon: Truck },
    {
      to: '/expenses',
      label: isMandob ? 'مصاريف خط السير' : isCashier ? 'مصروفات الدرج' : 'المصروفات',
      icon: Wallet,
    },
    ...(canViewTreasuries ? [{ to: '/treasuries', label: 'الخزن والورديات', icon: Landmark }] : []),
    {
      to: '/wc-orders',
      label: isMandob ? 'طلبات التوصيل والشحن' : 'طلبات المتجر (الشحن)',
      icon: ShoppingBag,
    },
    ...(isOwner || isManager
      ? [
          { to: '/transfers', label: 'تحويلات المخزون', icon: ArrowLeftRight },
        ]
      : []),
    ...(isOwnerOrAdmin
      ? [
          { to: '/branches', label: 'الفروع والمخازن', icon: Building2 },
          { to: '/woocommerce', label: 'ربط WooCommerce', icon: Globe },
        ]
      : []),
    ...(canViewProfitReport || isManager
      ? [{ to: '/reports', label: isOwner ? 'التقارير والأرباح' : 'التقارير والمبيعات', icon: BarChart3 }]
      : []),
    ...(isOwner || isManager ? [{ to: '/excel', label: 'استيراد وتصدير Excel', icon: FileSpreadsheet }] : []),
    ...(canManageEmployees ? [{ to: '/employees', label: 'فريق العمل والمناديب', icon: UserCheck }] : []),
    ...(canManageSettings ? [{ to: '/settings', label: 'الإعدادات والاشتراك', icon: Settings }] : []),
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

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden" dir="rtl">
      {/* Offline Alert Banner */}
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar (lg and above) */}
        <aside className="hidden lg:flex w-64 bg-white border-l border-slate-200 flex-col shadow-sm">
          {/* App Branding */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <Link to="/dashboard" className="flex items-center gap-1.5 group">
              <span className="font-black text-xl tracking-tighter text-slate-900 font-sans flex items-center">
                Engaz<span className="text-emerald-500">.</span>
                <span className="mr-1.5 text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-1.5 py-0.5 rounded-md shadow-2xs">
                  PRO
                </span>
              </span>
              <span className="text-xs font-bold text-slate-400 border-r border-slate-200 pr-2 mr-1">
                إنجاز برو
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Desktop Sidebar Footer & PWA Install */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
            <PWAInstallButton variant="sidebar" />

            {isOwner ? (
              <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                <span className="font-medium">الاشتراك:</span>
                <span
                  className={clsx(
                    'font-bold px-2 py-0.5 rounded-full text-xs',
                    isSubscriptionValid
                      ? 'text-primary-700 bg-primary-100'
                      : 'text-rose-700 bg-rose-100'
                  )}
                >
                  {isSubscriptionValid ? `نشط (${daysRemaining} يوم)` : 'منتهي الصلاحية'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                <span className="font-medium">الحساب:</span>
                <span className="font-bold px-2 py-0.5 rounded-full text-xs text-indigo-700 bg-indigo-50 border border-indigo-200">
                  {roleTitle}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                {user?.name || 'مستخدم النظام'}
              </p>
              <button
                onClick={handleLogout}
                title="تسجيل الخروج"
                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
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
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Slide Panel */}
            <aside className="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 bg-slate-50/50">
                <Link to="/dashboard" onClick={() => setIsMobileDrawerOpen(false)} className="flex items-center gap-1.5">
                  <span className="font-black text-lg tracking-tighter text-slate-900 font-sans flex items-center">
                    Engaz<span className="text-emerald-500">.</span>
                    <span className="mr-1 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-1.5 py-0.5 rounded-md">
                      PRO
                    </span>
                  </span>
                  <span className="text-xs font-bold text-slate-400 border-r border-slate-200 pr-1.5 mr-1">
                    إنجاز برو
                  </span>
                </Link>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-50 text-primary-700 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )
                      }
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <PWAInstallButton variant="sidebar" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
                      {user?.name || 'مستخدم النظام'}
                    </p>
                    <span className="text-[10px] text-slate-500">{roleTitle}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl font-bold transition-colors"
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
            <div className="bg-rose-600 text-white px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-bold shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>اشتراكك منتهي الصلاحية. يرجى تجديد الاشتراك السنوي لمتابعة العمليات.</span>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="bg-white text-rose-700 px-3 py-1 rounded-md text-xs font-black hover:bg-rose-50 flex-shrink-0"
              >
                تجديد الآن
              </button>
            </div>
          )}

          {/* Top Header */}
          <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
            {/* Left/Right Header Area */}
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="p-2 -mr-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl lg:hidden focus:outline-none"
                title="القائمة"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Mobile App Branding */}
              <Link to="/dashboard" className="flex items-center gap-1.5 lg:hidden">
                <span className="font-black text-base tracking-tighter text-slate-900 font-sans flex items-center">
                  Engaz<span className="text-emerald-500">.</span>
                  <span className="mr-1 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-1.5 py-0.5 rounded-md">
                    PRO
                  </span>
                </span>
              </Link>

              {/* Greeting & Role on Tablet & Desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">
                  مرحباً، <strong className="text-slate-900">{user?.name || 'المستخدم'}</strong>
                  {isOwner && (
                    <span className="mr-2 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                      صاحب العمل
                    </span>
                  )}
                  {isManager && (
                    <span className="mr-2 text-xs bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-bold border border-purple-200">
                      مدير الفرع
                    </span>
                  )}
                  {isSupervisor && (
                    <span className="mr-2 text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
                      مشرف ورديات
                    </span>
                  )}
                  {isMandob && (
                    <span className="mr-2 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
                      مندوب مبيعات
                    </span>
                  )}
                  {isCashier && (
                    <span className="mr-2 text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold border border-amber-200">
                      كاشير POS
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2.5">
              {/* PWA Install Button */}
              <PWAInstallButton variant="header" />

              {/* Online Connection Badge */}
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 sm:px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">الخادم متصل</span>
              </span>
            </div>
          </header>

          {/* Page View with Responsive Bottom Padding for Mobile Nav */}
          <main className="flex-1 overflow-y-auto p-2.5 sm:p-6 bg-slate-50 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
            <ActiveShiftBanner />
            <Suspense
              fallback={
                <div className="w-full py-16 flex flex-col items-center justify-center text-center animate-in fade-in duration-150" dir="rtl">
                  <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
                  <span className="mt-3 text-xs font-bold text-slate-400 font-sans">جاري فتح الصفحة...</span>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <MobileBottomNav onOpenDrawer={() => setIsMobileDrawerOpen(true)} />
        </div>
      </div>
    </div>
  );
};
