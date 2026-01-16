import { useMemo } from "react";
import { 
  type UserRole, 
  type Permission, 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions,
  getPermissionsForRole,
  ROLE_LABELS,
  canManageRole,
} from "@shared/permissions";

interface UsePermissionsOptions {
  role: UserRole | null | undefined;
}

export function usePermissions({ role }: UsePermissionsOptions) {
  const currentRole = role || "rbt";

  const permissions = useMemo(() => {
    return getPermissionsForRole(currentRole as UserRole);
  }, [currentRole]);

  const can = useMemo(() => {
    return (permission: Permission) => hasPermission(currentRole as UserRole, permission);
  }, [currentRole]);

  const canAny = useMemo(() => {
    return (perms: Permission[]) => hasAnyPermission(currentRole as UserRole, perms);
  }, [currentRole]);

  const canAll = useMemo(() => {
    return (perms: Permission[]) => hasAllPermissions(currentRole as UserRole, perms);
  }, [currentRole]);

  const canManage = useMemo(() => {
    return (targetRole: UserRole) => canManageRole(currentRole as UserRole, targetRole);
  }, [currentRole]);

  const roleLabel = ROLE_LABELS[currentRole as UserRole] || currentRole;

  return {
    role: currentRole as UserRole,
    roleLabel,
    permissions,
    can,
    canAny,
    canAll,
    canManage,
    isAdmin: currentRole === "admin" || currentRole === "clinical_manager",
    isClinicalManager: currentRole === "clinical_manager",
    isBCBA: currentRole === "bcba",
    isLeadRBT: currentRole === "lead_rbt",
    isRBT: currentRole === "rbt",
    isCaregiver: currentRole === "caregiver",
  };
}

export function useCurrentUser() {
  const storedUser = localStorage.getItem("anchor_current_user");
  if (storedUser) {
    try {
      return JSON.parse(storedUser) as { id: string; username: string; role: UserRole; displayName?: string };
    } catch {
      return null;
    }
  }
  return null;
}

export function useCurrentPermissions() {
  const user = useCurrentUser();
  return usePermissions({ role: user?.role });
}
