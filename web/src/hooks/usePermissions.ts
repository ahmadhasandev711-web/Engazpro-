import { useAuthStore } from '../data/store/useAuthStore';
import { UserRole } from '@pos-mandob/shared';

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);

  const isMandob = user?.role === UserRole.MANDOB;
  const isCashier = user?.role === UserRole.CASHIER;
  const isManager = user?.role === UserRole.MANAGER;
  const isSupervisor = user?.role === UserRole.SUPERVISOR;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isOwner = !user?.owner_id && (user?.role === UserRole.OWNER || !user?.role);
  const isOwnerOrAdmin = isOwner || isAdmin;

  return {
    user,
    isOwner,
    isAdmin,
    isOwnerOrAdmin,
    isManager,
    isSupervisor,
    isMandob,
    isCashier,
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
    // Parties Permissions
    canDeleteParty: isOwnerOrAdmin,
    canManageSuppliers: isOwnerOrAdmin || isManager,
    // Expense Permissions
    canDeleteExpense: isOwnerOrAdmin,
    canManageExpenses: true,
    // Payment Permissions
    canDeletePayment: isOwnerOrAdmin,
    canPaySuppliers: isOwnerOrAdmin || isManager,
    // Reports & Settings Permissions (STRICT: Profit only for Owner and Admin!)
    canViewProfitReport: isOwnerOrAdmin,
    canViewCashFlowReport: isOwnerOrAdmin || isManager,
    canManageEmployees: isOwnerOrAdmin || isManager,
    canManageBranches: isOwnerOrAdmin,
    canManageWooCommerce: isOwnerOrAdmin,
    canManageSettings: isOwnerOrAdmin,
  };
};
