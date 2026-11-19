import { useAuthStore } from '../data/store/useAuthStore';
import { EcommercePlatform, UserRole } from '@pos-mandob/shared';

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);

  const isMandob = user?.role === UserRole.MANDOB;
  const isCashier = user?.role === UserRole.CASHIER;
  const isSales = user?.role === UserRole.SALES;
  const isManager = user?.role === UserRole.MANAGER;
  const isSupervisor = user?.role === UserRole.SUPERVISOR;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isOwner = !user?.owner_id && (user?.role === UserRole.OWNER || !user?.role);
  const isOwnerOrAdmin = isOwner || isAdmin;
  const hasEcommerceAddon = Boolean(user?.ecommerce_enabled);
  const activeEcommercePlatform = user?.active_ecommerce_platform ?? null;

  return {
    user,
    isOwner,
    isAdmin,
    isOwnerOrAdmin,
    isManager,
    isSupervisor,
    isMandob,
    isCashier,
    isSales,
    // Shift & Treasury Permissions
    canOperateShift: isCashier || isMandob,
    canSettleShifts: isOwnerOrAdmin || isManager || isSupervisor,
    canViewTreasuries: isOwnerOrAdmin || isManager || isSupervisor,
    canManageTreasury: isOwnerOrAdmin || isManager,
    canManageBanks: isOwnerOrAdmin,
    canCreateTreasury: isOwnerOrAdmin,
    canViewAllTreasuries: isOwnerOrAdmin,
    // Product Permissions
    canAddProduct: isOwnerOrAdmin || isManager,
    canEditProduct: isOwnerOrAdmin || isManager,
    canDeleteProduct: isOwnerOrAdmin,
    canImportProducts: isOwnerOrAdmin || isManager,
    // Purchase Price: Visible to Owner, Admin, and Branch Manager!
    canViewPurchasePrice: isOwnerOrAdmin || isManager,
    // Invoice Permissions
    canDeleteInvoice: isOwnerOrAdmin,
    canCreatePurchases: isOwnerOrAdmin || isManager,
    canEditInvoiceSalesperson: isOwnerOrAdmin || isManager,
    // Parties & Categories & Couriers Permissions
    canDeleteParty: isOwnerOrAdmin,
    canManageSuppliers: isOwnerOrAdmin || isManager,
    canManageCustomerTier: isOwnerOrAdmin || isManager || isSupervisor,
    canViewSupplierLedger: isOwnerOrAdmin || isManager || isSupervisor,
    canDeleteCategory: isOwnerOrAdmin || isManager,
    canSettleCouriers: isOwnerOrAdmin || isManager || isSupervisor || isCashier,
    canManageCouriers: isOwnerOrAdmin || isManager || isSupervisor,
    // Expense Permissions
    canDeleteExpense: isOwnerOrAdmin || isManager || isSupervisor || isCashier,
    canManageExpenses: true,
    // Payment Permissions
    canDeletePayment: isOwnerOrAdmin,
    canPaySuppliers: isOwnerOrAdmin || isManager,
    canIssuePaymentVouchers: isOwnerOrAdmin || isManager || isSupervisor || isCashier || isMandob,
    canViewEmployeePaymentsScope: isOwnerOrAdmin || isManager || isSupervisor,
    // Reports & Stock Operations & Transfers
    canViewProfitReport: isOwnerOrAdmin,
    canViewPurchaseReport: isOwnerOrAdmin || isManager,
    canViewCashFlowReport: isOwnerOrAdmin || isManager,
    canViewReceivablesPayablesReport: isOwnerOrAdmin || (isManager && !user?.branch_id),
    canManageStockOperations: isOwnerOrAdmin || isManager || isSupervisor,
    canViewStockTransfers: isOwnerOrAdmin || isManager || isSupervisor || isCashier,
    canCreateStockTransfer: isOwnerOrAdmin || isManager || isSupervisor,
    canReceiveStockTransfer: isOwnerOrAdmin || isManager || isSupervisor || isCashier,
    canManageEmployees: isOwnerOrAdmin || isManager,
    canManageBranches: isOwnerOrAdmin,
    canManageWooCommerce: isOwnerOrAdmin && hasEcommerceAddon,
    hasEcommerceAddon,
    activeEcommercePlatform,
    canManageEcommerceSettings: isOwnerOrAdmin && hasEcommerceAddon,
    canViewStoreOrders: hasEcommerceAddon && activeEcommercePlatform !== null,
    canViewWooOrders: hasEcommerceAddon && activeEcommercePlatform === EcommercePlatform.WOOCOMMERCE,
    canViewShopifyOrders: hasEcommerceAddon && activeEcommercePlatform === EcommercePlatform.SHOPIFY,
    canTransferOnlineOrderBranch: isOwnerOrAdmin || isManager || isSupervisor,
    canManageSettings: isOwnerOrAdmin,
  };
};
