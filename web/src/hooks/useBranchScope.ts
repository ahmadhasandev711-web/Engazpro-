import { UserRole } from '@pos-mandob/shared';
import { useMemo } from 'react';
import { useAuthStore } from '../data/store/useAuthStore';

/**
 * Single source of truth on the frontend matching Backend BranchScopeService / User::hasGlobalBranchAccess().
 * - OWNER & ADMIN: global access across all store branches.
 * - MANAGER & SUPERVISOR with branch_id === null ("عام على كل الفروع"): global access across branches.
 * - Any staff with a specific branch_id, plus CASHIER / MANDOB / SALES: strictly locked to lockedBranchId.
 */
export function useBranchScope() {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const role = user?.role;
    const isOwner = role === UserRole.OWNER || (!role && !user?.owner_id);
    const isAdmin = role === UserRole.ADMIN;
    const isOwnerOrAdmin = Boolean(isOwner || isAdmin);
    const isGeneralOps = (role === UserRole.MANAGER || role === UserRole.SUPERVISOR) && !user?.branch_id;
    const hasGlobalBranchAccess = Boolean(isOwnerOrAdmin || isGeneralOps);
    const lockedBranchId = hasGlobalBranchAccess ? null : (user?.branch_id ?? null);

    return {
      user,
      role,
      isOwnerOrAdmin,
      hasGlobalBranchAccess,
      isBranchLocked: !hasGlobalBranchAccess,
      lockedBranchId,
      resolveEffectiveBranchId: (selected?: number | string | null): number | null => {
        if (!hasGlobalBranchAccess) {
          return lockedBranchId;
        }
        return selected !== undefined && selected !== null && selected !== '' ? Number(selected) : null;
      },
      canAccessBranchId: (branchId?: number | null): boolean => {
        if (hasGlobalBranchAccess) {
          return true;
        }
        return lockedBranchId !== null && branchId !== undefined && branchId !== null && Number(branchId) === Number(lockedBranchId);
      },
    };
  }, [user]);
}
