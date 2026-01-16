import { ReactNode } from "react";
import { type Permission } from "@shared/permissions";
import { useCurrentPermissions } from "@/hooks/use-permissions";

interface PermissionGateProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll } = useCurrentPermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = can(permission);
  } else if (permissions) {
    hasAccess = requireAll ? canAll(permissions) : canAny(permissions);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleGateProps {
  roles: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ roles, fallback = null, children }: RoleGateProps) {
  const { role } = useCurrentPermissions();

  if (!roles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate roles={["clinical_manager", "admin"]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export function ManagerOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate roles={["clinical_manager"]} fallback={fallback}>
      {children}
    </RoleGate>
  );
}
