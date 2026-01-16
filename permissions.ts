export const USER_ROLES = [
  "clinical_manager",
  "bcba", 
  "admin",
  "lead_rbt",
  "rbt",
  "caregiver",
] as const;

export type UserRole = typeof USER_ROLES[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  clinical_manager: "Clinical Manager",
  bcba: "BCBA",
  admin: "Admin",
  lead_rbt: "Lead RBT",
  rbt: "RBT",
  caregiver: "Caregiver",
};

export const PERMISSIONS = [
  "view_schedule",
  "edit_schedule",
  "run_scheduler",
  "manage_staff",
  "manage_clients",
  "manage_template",
  "approve_exceptions",
  "view_reports",
  "export_schedule",
  "manage_training",
  "view_change_log",
  "manage_settings",
  "view_performance",
  "manage_users",
] as const;

export type Permission = typeof PERMISSIONS[number];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  clinical_manager: [
    "view_schedule",
    "edit_schedule",
    "run_scheduler",
    "manage_staff",
    "manage_clients",
    "manage_template",
    "approve_exceptions",
    "view_reports",
    "export_schedule",
    "manage_training",
    "view_change_log",
    "manage_settings",
    "view_performance",
    "manage_users",
  ],
  bcba: [
    "view_schedule",
    "edit_schedule",
    "run_scheduler",
    "manage_clients",
    "manage_template",
    "approve_exceptions",
    "view_reports",
    "export_schedule",
    "manage_training",
    "view_change_log",
  ],
  admin: [
    "view_schedule",
    "edit_schedule",
    "run_scheduler",
    "manage_staff",
    "manage_clients",
    "manage_template",
    "approve_exceptions",
    "view_reports",
    "export_schedule",
    "view_change_log",
    "manage_settings",
  ],
  lead_rbt: [
    "view_schedule",
    "approve_exceptions",
    "view_reports",
    "export_schedule",
    "view_change_log",
  ],
  rbt: [
    "view_schedule",
    "view_reports",
  ],
  caregiver: [
    "view_schedule",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function getRoleHierarchyLevel(role: UserRole): number {
  const hierarchy: Record<UserRole, number> = {
    clinical_manager: 6,
    bcba: 5,
    admin: 4,
    lead_rbt: 3,
    rbt: 2,
    caregiver: 1,
  };
  return hierarchy[role] || 0;
}

export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  return getRoleHierarchyLevel(managerRole) > getRoleHierarchyLevel(targetRole);
}
