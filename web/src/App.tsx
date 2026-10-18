import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './presentation/components/Layout';
import { ProtectedRoute } from './presentation/components/ProtectedRoute';
import { RoleRoute } from './presentation/components/RoleRoute';
import { AdminRoute } from './presentation/components/AdminRoute';
import { ConfirmProvider } from './presentation/context/ConfirmContext';
import { UserRole } from '@pos-mandob/shared';
import { useAuthStore } from './data/store/useAuthStore';
import { useCapacitorBootstrap } from './platform/useCapacitorBootstrap';
import { Capacitor } from '@capacitor/core';
import { AuthHydrationGate } from './presentation/components/AuthHydrationGate';

// Code-Splitting & Lazy Loading for blazing-fast POS initialization
const LandingPage = lazy(() => import('./presentation/pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./presentation/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./presentation/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./presentation/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProductsPage = lazy(() => import('./presentation/pages/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const InvoicesPage = lazy(() => import('./presentation/pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const InvoiceFormPage = lazy(() => import('./presentation/pages/InvoiceFormPage').then((m) => ({ default: m.InvoiceFormPage })));
const PartiesPage = lazy(() => import('./presentation/pages/PartiesPage').then((m) => ({ default: m.PartiesPage })));
const PaymentsPage = lazy(() => import('./presentation/pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const ExpensesPage = lazy(() => import('./presentation/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const LedgerPage = lazy(() => import('./presentation/pages/LedgerPage').then((m) => ({ default: m.LedgerPage })));
const ReportsPage = lazy(() => import('./presentation/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ExcelPage = lazy(() => import('./presentation/pages/ExcelPage').then((m) => ({ default: m.ExcelPage })));
const SettingsPage = lazy(() => import('./presentation/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const EmployeesPage = lazy(() => import('./presentation/pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const TreasuriesPage = lazy(() => import('./presentation/pages/TreasuriesPage').then((m) => ({ default: m.TreasuriesPage })));
const BranchesPage = lazy(() => import('./presentation/pages/BranchesPage').then((m) => ({ default: m.BranchesPage })));
const StockTransfersPage = lazy(() => import('./presentation/pages/StockTransfersPage').then((m) => ({ default: m.StockTransfersPage })));
const PosPage = lazy(() => import('./presentation/pages/PosPage').then((m) => ({ default: m.PosPage })));
const AdminDashboardPage = lazy(() => import('./presentation/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const WooCommerceSettingsPage = lazy(() => import('./presentation/pages/WooCommerceSettingsPage').then((m) => ({ default: m.WooCommerceSettingsPage })));
const WcOrdersPage = lazy(() => import('./presentation/pages/WcOrdersPage').then((m) => ({ default: m.WcOrdersPage })));
const CouriersPage = lazy(() => import('./presentation/pages/CouriersPage').then((m) => ({ default: m.CouriersPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 3, // 3 minutes fresh cache (instant page switches without refetch spinners)
      gcTime: 1000 * 60 * 10,   // 10 minutes memory retention
    },
  },
});

// Prefetch critical chunks on web only (native APK keeps startup lean)
if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  const prefetchCorePages = () => {
    import('./presentation/pages/DashboardPage');
    import('./presentation/pages/ProductsPage');
    import('./presentation/pages/InvoicesPage');
    import('./presentation/pages/PosPage');
    import('./presentation/pages/SettingsPage');
    import('./presentation/pages/PartiesPage');
    import('./presentation/pages/WcOrdersPage');
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(prefetchCorePages, { timeout: 4000 });
  } else {
    setTimeout(prefetchCorePages, 2000);
  }
}

const PageLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center" dir="rtl">
    <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
    <span className="mt-3 text-xs font-bold text-slate-500 font-sans">جاري تحميل الصفحة...</span>
  </div>
);

const RootRouteHandler: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  // On native mobile devices, go straight to login register screen
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/login" replace />;
  }
  return <LandingPage />;
};

const LandingRoute: React.FC = () => {
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/login" replace />;
  }
  return <LandingPage />;
};

const AppLifecycleManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useCapacitorBootstrap();
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppLifecycleManager>
          <AuthHydrationGate>
          <ConfirmProvider>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              {/* Public Landing & Auth Routes */}
              <Route path="/" element={<RootRouteHandler />} />
              <Route path="/landing" element={<LandingRoute />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Application Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  
                  {/* Sales & Sales Returns */}
                  <Route path="/sales" element={<InvoicesPage />} />
                  <Route path="/sales/new" element={<InvoiceFormPage />} />
                  <Route path="/sales/returns" element={<InvoicesPage />} />
                  <Route path="/sales/returns/new" element={<InvoiceFormPage />} />
                  
                  {/* Payments & Customers & Expenses (Accessible to all roles) */}
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/customers" element={<PartiesPage />} />
                  <Route path="/couriers" element={<CouriersPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/ledger/:partyId" element={<LedgerPage />} />
                  
                  {/* WooCommerce Orders (Accessible to Cashier, Supervisor, Mandob, Manager, Owner) */}
                  <Route path="/wc-orders" element={<WcOrdersPage />} />

                  {/* Treasuries & Shifts Management (Owner, Admin, Manager, Supervisor) */}
                  <Route element={<RoleRoute allowedRoles={[UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR]} />}>
                    <Route path="/treasuries" element={<TreasuriesPage />} />
                  </Route>

                  {/* Purchases, Suppliers, Reports, Transfers & Employees (Owner, Admin, Manager) */}
                  <Route element={<RoleRoute allowedRoles={[UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER]} />}>
                    <Route path="/purchases" element={<InvoicesPage />} />
                    <Route path="/purchases/new" element={<InvoiceFormPage />} />
                    <Route path="/purchases/returns" element={<InvoicesPage />} />
                    <Route path="/purchases/returns/new" element={<InvoiceFormPage />} />
                    <Route path="/suppliers" element={<PartiesPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/excel" element={<ExcelPage />} />
                    <Route path="/transfers" element={<StockTransfersPage />} />
                    <Route path="/employees" element={<EmployeesPage />} />
                  </Route>

                  {/* Sovereign Owner & Admin Only Routes (Settings, Branches & WooCommerce) */}
                  <Route element={<RoleRoute allowedRoles={[UserRole.OWNER, UserRole.ADMIN]} />}>
                    <Route path="/branches" element={<BranchesPage />} />
                    <Route path="/woocommerce" element={<WooCommerceSettingsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Route>

                {/* Standalone Full-Screen POS Cashier Register */}
                <Route path="/pos" element={<PosPage />} />

                {/* Standalone Master Super Admin Portal */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
                  <Route path="/admin-dashbord" element={<Navigate to="/admin-dashboard" replace />} />
                </Route>
              </Route>

              {/* Catch All Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ConfirmProvider>
          </AuthHydrationGate>
        </AppLifecycleManager>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
