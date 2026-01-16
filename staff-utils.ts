/**
 * Staff Utilities Module
 * 
 * Consolidated staff constraint checking and filtering utilities.
 * This module provides a single source of truth for staff-related checks
 * used throughout the scheduling engine.
 */

import type { Staff } from "./types";

/**
 * Staff role hierarchy for scheduling purposes.
 * Higher numbers indicate more senior roles.
 */
export const STAFF_ROLE_HIERARCHY: Record<string, number> = {
  'BT': 1,
  'RBT': 2,
  'Float': 3,
  'Lead RBT': 4,
  'BCBA': 5,
  'Admin': 6,
  'Lead BCBA': 7,
  'Clinical Manager': 8,
};

/**
 * Checks if a staff member has the noLunch constraint (works through lunch).
 */
export function hasNoLunchConstraint(staff: Staff): boolean {
  return staff.noLunch === true;
}

/**
 * Checks if a staff member has the noLateLunches constraint.
 */
export function hasNoLateLunchConstraint(staff: Staff): boolean {
  return staff.noLateLunches === true;
}

/**
 * Checks if a staff member is a Lead RBT.
 */
export function isLeadRbt(staff: Staff): boolean {
  return staff.role === 'Lead RBT';
}

/**
 * Checks if a staff member is a Float.
 */
export function isFloat(staff: Staff): boolean {
  return staff.role === 'Float';
}

/**
 * Checks if a staff member is a BCBA or higher (non-direct service).
 */
export function isBcbaOrHigher(staff: Staff): boolean {
  const role = staff.role;
  return role === 'BCBA' || role === 'Admin' || role === 'Lead BCBA' || role === 'Clinical Manager';
}

/**
 * Checks if a staff member has a medical break requirement.
 */
export function hasBreakRequired(staff: Staff): boolean {
  return staff.breakRequired === true;
}

/**
 * Builds a Set of staff IDs who have the noLunch constraint.
 */
export function buildNoLunchStaffSet(allStaff: Staff[]): Set<string> {
  return new Set(
    allStaff.filter(s => s.noLunch === true).map(s => s.id)
  );
}

/**
 * Builds a Set of staff IDs who have the noLateLunches constraint.
 */
export function buildNoLateLunchStaffSet(allStaff: Staff[]): Set<string> {
  return new Set(
    allStaff.filter(s => s.noLateLunches === true).map(s => s.id)
  );
}

/**
 * Builds a Set of Lead RBT staff IDs.
 */
export function buildLeadRbtSet(allStaff: Staff[]): Set<string> {
  return new Set(
    allStaff.filter(s => s.role === 'Lead RBT').map(s => s.id)
  );
}

/**
 * Builds a Set of Float staff IDs.
 */
export function buildFloatSet(allStaff: Staff[]): Set<string> {
  return new Set(
    allStaff.filter(s => s.role === 'Float').map(s => s.id)
  );
}

/**
 * Checks if a staff member is excluded from working with a client.
 */
export function isStaffExcludedFromClient(
  staffId: string, 
  excludedStaffIds: string[], 
  noLongerTrainedIds: string[]
): boolean {
  return excludedStaffIds.includes(staffId) || noLongerTrainedIds.includes(staffId);
}

/**
 * Gets the staffing category for a staff member based on their relationship to a client.
 * Returns: 'focus' | 'trained' | 'float' | 'sub' | 'lead' | 'excluded' | 'unknown'
 */
export function getStaffClientCategory(
  staffId: string,
  focusStaffId: string | null | undefined,
  trainedStaffIds: string[],
  allowedFloatRbtIds: string[],
  allowedSubRbtIds: string[],
  allowedLeadRbtIds: string[],
  excludedStaffIds: string[],
  noLongerTrainedIds: string[],
  staffRole: string
): 'focus' | 'trained' | 'float' | 'sub' | 'lead' | 'excluded' | 'unknown' {
  // Check exclusions first
  if (excludedStaffIds.includes(staffId) || noLongerTrainedIds.includes(staffId)) {
    return 'excluded';
  }
  
  // Check focus
  if (focusStaffId === staffId) {
    return 'focus';
  }
  
  // Check trained
  if (trainedStaffIds.includes(staffId)) {
    return 'trained';
  }
  
  // Check float (must be Float role AND in allowed list)
  if (staffRole === 'Float' && allowedFloatRbtIds.includes(staffId)) {
    return 'float';
  }
  
  // Check sub (must be in allowed list)
  if (allowedSubRbtIds.includes(staffId)) {
    return 'sub';
  }
  
  // Check lead (must be Lead RBT role AND in allowed list)
  if (staffRole === 'Lead RBT' && allowedLeadRbtIds.includes(staffId)) {
    return 'lead';
  }
  
  return 'unknown';
}

/**
 * Filters staff list to only include direct service providers (BT, RBT, Float, Lead RBT).
 */
export function filterDirectServiceStaff(allStaff: Staff[]): Staff[] {
  const directServiceRoles = ['BT', 'RBT', 'Float', 'Lead RBT'];
  return allStaff.filter(s => directServiceRoles.includes(s.role));
}

/**
 * Sorts staff by role hierarchy (least senior first).
 */
export function sortStaffByRoleAscending(staff: Staff[]): Staff[] {
  return [...staff].sort((a, b) => {
    const aRank = STAFF_ROLE_HIERARCHY[a.role] || 0;
    const bRank = STAFF_ROLE_HIERARCHY[b.role] || 0;
    return aRank - bRank;
  });
}

/**
 * Sorts staff by role hierarchy (most senior first).
 */
export function sortStaffByRoleDescending(staff: Staff[]): Staff[] {
  return [...staff].sort((a, b) => {
    const aRank = STAFF_ROLE_HIERARCHY[a.role] || 0;
    const bRank = STAFF_ROLE_HIERARCHY[b.role] || 0;
    return bRank - aRank;
  });
}
