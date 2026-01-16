import type { Staff } from "@shared/schema";

/**
 * Formats staff name as "FirstName L." (first letter of last name)
 * If there are duplicates with the same format, the newer staff (by hireDate) 
 * gets "FirstName La." (first two letters of last name)
 */
export function formatStaffDisplayName(
  staff: Staff,
  allStaff: Staff[]
): string {
  const nameParts = staff.name.trim().split(/\s+/);
  
  if (nameParts.length < 2) {
    return staff.name;
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const lastInitial = lastName.charAt(0).toUpperCase();
  
  const baseFormat = `${firstName} ${lastInitial}.`;
  
  const duplicates = allStaff.filter(s => {
    if (s.id === staff.id) return false;
    const otherParts = s.name.trim().split(/\s+/);
    if (otherParts.length < 2) return false;
    const otherFirst = otherParts[0];
    const otherLast = otherParts[otherParts.length - 1];
    return (
      otherFirst.toLowerCase() === firstName.toLowerCase() &&
      otherLast.charAt(0).toUpperCase() === lastInitial
    );
  });
  
  if (duplicates.length === 0) {
    return baseFormat;
  }
  
  const allWithSameFormat = [staff, ...duplicates];
  
  allWithSameFormat.sort((a, b) => {
    const dateA = a.hireDate ? new Date(a.hireDate).getTime() : 0;
    const dateB = b.hireDate ? new Date(b.hireDate).getTime() : 0;
    return dateA - dateB;
  });
  
  const isOldest = allWithSameFormat[0].id === staff.id;
  
  if (isOldest) {
    return baseFormat;
  }
  
  const twoLetterLastName = lastName.substring(0, 2);
  return `${firstName} ${twoLetterLastName.charAt(0).toUpperCase()}${twoLetterLastName.charAt(1)?.toLowerCase() || ''}.`;
}

/**
 * Creates a lookup map for all staff display names
 */
export function createStaffDisplayNameMap(staffList: Staff[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const staff of staffList) {
    map.set(staff.id, formatStaffDisplayName(staff, staffList));
  }
  return map;
}
