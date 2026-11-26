import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './data/api/queryClient';
import { Layout } from './presentation/components/Layout';
import { ProtectedRoute } from './presentation/components/ProtectedRoute';
import { RoleRoute } from './presentation/components/RoleRoute';
import { AdminRoute } from './presentation/components/AdminRoute';
import { ConfirmProvider } from './presentation/context/ConfirmContext';
import { ToastProvider } from './presentation/context/ToastContext';
import { ThemeProvider } from './presentation/context/ThemeContext';
import { AppErrorBoundary } from './presentation/components/common/AppErrorBoundary';
import { UserRole } from '@pos-mandob/shared';
import { useAuthStore } from './data/store/useAuthStore';
import { AuthHydrationGate } from './presentation/components/AuthHydrationGate';
import { LoadingSpinnerView } from './presentation/components/common/LoadingSpinnerView';

// Code-Splitting & Lazy Loading for blazing-fast POS initialization
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
const PromotionsPage = lazy(() => import('./presentation/pages/PromotionsPage').then((m) => ({ default: m.PromotionsPage })));
const StockTransfersPage = lazy(() => import('./presentation/pages/StockTransfersPage').then((m) => ({ default: m.StockTransfersPage })));
const StockOperationsPage = lazy(() => import('./presentation/pages/StockOperationsPage').then((m) => ({ default: m.StockOperationsPage })));
const PosPage = lazy(() => import('./presentation/pages/PosPage').then((m) => ({ default: m.PosPage })));
const ExchangesPage = lazy(() => import('./presentation/pages/ExchangesPage').then((m) => ({ default: m.ExchangesPage })));
const PosExchangePage = lazy(() => import('./presentation/pages/PosExchangePage').then((m) => ({ default: m.PosExchangePage })));
const AdminDashboardPage = lazy(() => import('./presentation/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const WooCommerceSettingsPage = lazy(() => import('./presentation/pages/WooCommerceSettingsPage').then((m) => ({ default: m.WooCommerceSettingsPage })));
const ShopifySettingsPage = lazy(() => import('./presentation/pages/ShopifySettingsPage').then((m) => ({ default: m.ShopifySettingsPage })));
const EasyOrdersSettingsPage = lazy(() => import('./presentation/pages/EasyOrdersSettingsPage').then((m) => ({ default: m.EasyOrdersSettingsPage })));
const StoreOrdersPage = lazy(() => import('./presentation/pages/StoreOrdersPage').then((m) => ({ default: m.StoreOrdersPage })));
const CouriersPage = lazy(() => import('./presentation/pages/CouriersPage').then((m) => ({ default: m.CouriersPage })));
const ShopHomePage = lazy(() => import('./presentation/pages/shop/ShopHomePage').then((m) => ({ default: m.ShopHomePage })));
const ShopProductDetailPage = lazy(() => import('./presentation/pages/shop/ShopProductDetailPage').then((m) => ({ default: m.ShopProductDetailPage })));
const ShopCartPage = lazy(() => import('./presentation/pages/shop/ShopCartPage').then((m) => ({ default: m.ShopCartPage })));
const ShopCheckoutPage = lazy(() => import('./presentation/pages/shop/ShopCheckoutPage').then((m) => ({ default: m.ShopCheckoutPage })));
const ShopOrdersPage = lazy(() => import('./presentation/pages/shop/ShopOrdersPage').then((m) => ({ default: m.ShopOrdersPage })));
const ShopOrderDetailPage = lazy(() => import('./presentation/pages/shop/ShopOrderDetailPage').then((m) => ({ default: m.ShopOrderDetailPage })));

if (typeof window !== 'undefined') {
  const prefetchCorePages = () => {
    import('./presentation/pages/DashboardPage');
    import('./presentation/pages/PosPage');
    window.setTimeout(() => {
      import('./presentation/pages/ProductsPage');
      import('./presentation/pages/InvoicesPage');
      import('./presentation/pages/PartiesPage');
      import('./presentation/pages/StoreOrdersPage');
    }, 1500);
  };

  if ('requestIdleCallback' in window) {
    setTimeout(() => (window as any).requestIdleCallback(prefetchCorePages, { timeout: 5000 }), 2500);
  } else {
    setTimeout(prefetchCorePages, 4000);
  }
}

const PageLoadingFallback: React.FC = () => (
  <LoadingSpinnerView message="جاري تحميل الصفحة..." />
);

const RootRouteHandler: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
};

const EcommerceRoute: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  if (!user?.ecommerce_enabled) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthHydrationGate>
          <ConfirmProvider>
            <ToastProvider>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              {/* Auth & Entry Routes (Landing Page hosted separately at https://easyfy.cloud) */}
              <Route path="/" element={<RootRouteHandler />} />
              <Route path="/landing" element={<RootRouteHandler />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Application Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  
                  {/* Sales & Sales Returns & Smart Exchanges */}
                  <Route path="/sales" element={<InvoicesPage />} />
                  <Route path="/sales/new" element={<InvoiceFormPage />} />
                  <Route path="/sales/returns" element={<InvoicesPage />} />
                  <Route path="/sales/returns/new" element={<InvoiceFormPage />} />
                  <Route path="/exchanges" element={<ExchangesPage />} />
                  <Route path="/exchanges/new" element={<PosExchangePage />} />
                  
                  {/* Payments & Customers & Expenses (Accessible to all roles) */}
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/customers" element={<PartiesPage />} />
                  <Route path="/couriers" element={<CouriersPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/ledger/:partyId" element={<LedgerPage />} />

                  {/* Easyfy B2B Supplies Store (Open to all store roles) */}
                  <Route path="/shop" element={<ShopHomePage />} />
                  <Route path="/shop/products/:slugOrId" element={<ShopProductDetailPage />} />
                  <Route path="/shop/cart" element={<ShopCartPage />} />
                  <Route path="/shop/checkout" element={<ShopCheckoutPage />} />
                  <Route path="/shop/orders" element={<ShopOrdersPage />} />
                  <Route path="/shop/orders/:id" element={<ShopOrderDetailPage />} />
                  
                  {/* Unified Store Orders (Only when e-commerce addon is enabled) */}
                  <Route element={<EcommerceRoute />}>
                    <Route path="/store-orders" element={<StoreOrdersPage />} />
                    <Route path="/wc-orders" element={<Navigate to="/store-orders" replace />} />
                    <Route path="/shopify-orders" element={<Navigate to="/store-orders" replace />} />
                  </Route>

                  {/* Treasuries & Shifts & Stock Operations & Transfers */}
                  <Route element={<RoleRoute allowedRoles={[UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR]} />}>
                    <Route path="/treasuries" element={<TreasuriesPage />} />
                    <Route path="/stock-operations" element={<StockOperationsPage />} />
                  </Route>

                  <Route element={<RoleRoute allowedRoles={[UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.CASHIER]} />}>
                    <Route path="/transfers" element={<StockTransfersPage />} />
                  </Route>

                  {/* Purchases, Suppliers, Reports & Employees (Owner, Admin, Manager) */}
                  <Route element={<RoleRoute allowedRoles={[UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER]} />}>
                    <Route path="/purchases" element={<InvoicesPage />} />
                    <Route path="/purchases/new" element={<InvoiceFormPage />} />
                    <Route path="/purchases/returns" element={<InvoicesPage />} />
                    <Route path="/purchases/returns/new" element={<InvoiceFormPage />} />
                    <Route path="/suppliers" element={<PartiesPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/promotions" element={<PromotionsPage />} />
                    <Route path="/excel" element={<ExcelPage />} />
                    <Route path="/employees" element={<EmployeesPage />} />
                  </Route>

                  {/* Sovereign Owner & Admin Only Routes (Settings, Branches & E-Commerce) */}
                  <Route element={<RoleRoute allowedRoles={[UserRole.OWNER, UserRole.ADMIN]} />}>
                    <Route path="/branches" element={<BranchesPage />} />
                    <Route element={<EcommerceRoute />}>
                      <Route path="/woocommerce" element={<WooCommerceSettingsPage />} />
                      <Route path="/shopify" element={<ShopifySettingsPage />} />
                      <Route path="/easyorders" element={<EasyOrdersSettingsPage />} />
                    </Route>
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Route>

                {/* Standalone Full-Screen POS Cashier Register */}
                <Route
                  path="/pos"
                  element={
                    <AppErrorBoundary fallbackTitle="حدث خطأ في شاشة نقطة البيع (POS)">
                      <PosPage />
                    </AppErrorBoundary>
                  }
                />

                {/* Standalone Master Super Admin Portal */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
                  <Route path="/admin-dashboard/:section" element={<AdminDashboardPage />} />
                  <Route path="/admin" element={<Navigate to="/admin-dashboard" replace />} />
                  <Route path="/admin/:section" element={<AdminDashboardPage />} />
                  <Route path="/admin-dashbord" element={<Navigate to="/admin-dashboard" replace />} />
                </Route>
              </Route>

              {/* Catch All Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
            </ToastProvider>
        </ConfirmProvider>
          </AuthHydrationGate>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
