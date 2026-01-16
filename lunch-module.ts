import type {
  Client,
  Staff,
  LunchGroup,
  LunchTime,
  LunchSlot,
  LunchSlotDetail,
  LunchCoverageResult,
  LunchCoverageError,
  ClientCoverageNeed,
  LocalTemplateAssignment,
  School,
  ClientLocation,
} from "./types";
import { timeStringToMinutes, TIME_CONSTANTS } from "./time-utils";
import { buildNoLunchStaffSet, buildNoLateLunchStaffSet, buildLeadRbtSet } from "./staff-utils";
import { isClientAvailable as checkClientAvailable, clientNeedsLunchCoverage, isSplitLocationClient, getSplitClientMiddayStatus } from "./client-utils";

type CoverageEntry = { 
  clientIds: string[]; 
  clientNames: string[]; 
  clientOriginalStaff: Map<string, string>; 
};

function createEmptyCoverage(): CoverageEntry {
  return { clientIds: [], clientNames: [], clientOriginalStaff: new Map() };
}

function canGroupClients(clientA: ClientCoverageNeed, clientB: ClientCoverageNeed, slot?: LunchSlot): boolean {
  if (!clientA.canBeGrouped || !clientB.canBeGrouped) return false;
  
  const aHasPeerRestrictions = clientA.allowedLunchPeerIds.length > 0;
  const bHasPeerRestrictions = clientB.allowedLunchPeerIds.length > 0;
  
  if (aHasPeerRestrictions && !clientA.allowedLunchPeerIds.includes(clientB.clientId)) {
    return false;
  }
  
  if (bHasPeerRestrictions && !clientB.allowedLunchPeerIds.includes(clientA.clientId)) {
    return false;
  }
  
  // Check slot-specific lunch pairing restrictions
  if (slot === "first") {
    // Check if either client restricts the other from first lunch pairing
    if (clientA.noFirstLunchPeerIds.includes(clientB.clientId) ||
        clientB.noFirstLunchPeerIds.includes(clientA.clientId)) {
      return false;
    }
  } else if (slot === "second") {
    // Check if either client restricts the other from second lunch pairing
    if (clientA.noSecondLunchPeerIds.includes(clientB.clientId) ||
        clientB.noSecondLunchPeerIds.includes(clientA.clientId)) {
      return false;
    }
  }
  
  const comboKey1 = `${clientA.clientId},${clientB.clientId}`;
  const comboKey2 = `${clientB.clientId},${clientA.clientId}`;
  if (clientA.disallowedGroupCombos.includes(comboKey1) || 
      clientA.disallowedGroupCombos.includes(comboKey2) ||
      clientB.disallowedGroupCombos.includes(comboKey1) || 
      clientB.disallowedGroupCombos.includes(comboKey2)) {
    return false;
  }
  
  return true;
}

function canAddToGroup(existingGroup: ClientCoverageNeed[], newClient: ClientCoverageNeed, slot?: LunchSlot): boolean {
  if (existingGroup.length >= 2 && !existingGroup.every(c => c.allowGroupsOf3) && !newClient.allowGroupsOf3) {
    return false;
  }
  if (existingGroup.length >= 3) return false;
  
  for (const existing of existingGroup) {
    if (!canGroupClients(existing, newClient, slot)) return false;
  }
  return true;
}

export function assignLunchGroups(
  activeStaffIds: string[],
  amAssignments: LocalTemplateAssignment[],
  pmAssignments: LocalTemplateAssignment[],
  allStaff?: Staff[],
  allClients?: Client[],
  dayKey?: string,
  unavailableClients?: Set<string>,
  schools?: School[],
  clientLocations?: ClientLocation[]
): LunchGroup {
  const lunchAt1100: string[] = [];
  const lunchAt1130: string[] = [];
  const lunchAt1200: string[] = [];
  const lunchAt1230: string[] = [];
  const staffLunchTimes = new Map<string, LunchTime>();
  
  // Minute-level lunch slot details for school staff
  const staffLunchDetails = new Map<string, LunchSlotDetail>();
  const schoolLunchWindows = new Map<string, { 
    startMinute: number; 
    endMinute: number; 
    firstSlot: LunchSlotDetail; 
    secondSlot: LunchSlotDetail 
  }>();
  
  // Use consolidated staff utilities
  const noLunchStaffIds = allStaff ? buildNoLunchStaffSet(allStaff) : new Set<string>();
  const noLateLunchStaffIds = allStaff ? buildNoLateLunchStaffSet(allStaff) : new Set<string>();
  const leadRbtIds = allStaff ? buildLeadRbtSet(allStaff) : new Set<string>();
  
  // Helper to check if a client is available (delegates to consolidated utility)
  const isClientAvailable = (clientId: string | null | undefined): boolean => {
    return checkClientAvailable(clientId, unavailableClients || new Set());
  };
  
  // Helper to get a staff's client IDs (AM and PM assignments)
  const getStaffClientIds = (staffId: string): string[] => {
    const clientIds: string[] = [];
    const amAssignment = amAssignments.find(a => a.staffId === staffId && a.clientId);
    const pmAssignment = pmAssignments.find(a => a.staffId === staffId && a.clientId);
    if (amAssignment?.clientId && isClientAvailable(amAssignment.clientId)) {
      clientIds.push(amAssignment.clientId);
    }
    if (pmAssignment?.clientId && isClientAvailable(pmAssignment.clientId)) {
      clientIds.push(pmAssignment.clientId);
    }
    return clientIds;
  };
  
  // Helper to get the school with alternative lunch for a client (if any)
  const getClientSchoolWithAltLunch = (clientId: string): { schoolId: string; startMinute: number; endMinute: number } | null => {
    if (!schools || !clientLocations) return null;
    
    const schoolLocation = clientLocations.find(loc => loc.clientId === clientId && loc.schoolId);
    if (!schoolLocation?.schoolId) return null;
    
    const school = schools.find(s => s.id === schoolLocation.schoolId);
    if (!school?.hasAlternativeLunch) return null;
    
    return {
      schoolId: school.id,
      startMinute: school.lunchWindowStartMinute,
      endMinute: school.lunchWindowEndMinute
    };
  };
  
  // Helper to check if staff has an AVAILABLE AM client
  const hasAvailableAmClient = (staffId: string): boolean => {
    const amAssignment = amAssignments.find(a => a.staffId === staffId && a.clientId);
    return amAssignment ? isClientAvailable(amAssignment.clientId) : false;
  };
  
  const staffWithAmClients: string[] = [];
  const staffWithPmClients: string[] = [];
  const staffWithBothClients: string[] = [];
  const staffWithNoClients: string[] = [];
  
  // Track staff assigned to school lunches
  const staffAssignedToSchoolLunch = new Set<string>();
  
  // ============================================================================
  // SCHOOL ALTERNATIVE LUNCH HANDLING
  // ============================================================================
  
  // Group staff by school with alternative lunch
  const staffBySchool = new Map<string, { staffIds: string[]; startMinute: number; endMinute: number }>();
  
  for (const staffId of activeStaffIds) {
    if (noLunchStaffIds.has(staffId)) continue;
    
    const clientIds = getStaffClientIds(staffId);
    for (const clientId of clientIds) {
      const schoolInfo = getClientSchoolWithAltLunch(clientId);
      if (schoolInfo) {
        const existing = staffBySchool.get(schoolInfo.schoolId) || {
          staffIds: [],
          startMinute: schoolInfo.startMinute,
          endMinute: schoolInfo.endMinute
        };
        if (!existing.staffIds.includes(staffId)) {
          existing.staffIds.push(staffId);
        }
        staffBySchool.set(schoolInfo.schoolId, existing);
        break;
      }
    }
  }
  
  // Assign school staff to alternating lunch slots within their school's window
  staffBySchool.forEach(({ staffIds, startMinute, endMinute }, schoolId) => {
    const midpoint = startMinute + Math.floor((endMinute - startMinute) / 2);
    
    const firstSlot: LunchSlotDetail = {
      label: "11:30",
      startMinute: startMinute,
      endMinute: midpoint,
      source: "school",
      schoolId: schoolId
    };
    
    const secondSlot: LunchSlotDetail = {
      label: "12:00",
      startMinute: midpoint,
      endMinute: endMinute,
      source: "school",
      schoolId: schoolId
    };
    
    schoolLunchWindows.set(schoolId, { startMinute, endMinute, firstSlot, secondSlot });
    
    const staffWithAm: string[] = [];
    const staffWithoutAm: string[] = [];
    
    for (const staffId of staffIds) {
      if (hasAvailableAmClient(staffId)) {
        staffWithAm.push(staffId);
      } else {
        staffWithoutAm.push(staffId);
      }
    }
    
    const assignSchoolLunch = (staffId: string, slot: LunchSlotDetail) => {
      staffLunchTimes.set(staffId, slot.label);
      if (slot.label === "11:00") lunchAt1100.push(staffId);
      else if (slot.label === "11:30") lunchAt1130.push(staffId);
      else if (slot.label === "12:00") lunchAt1200.push(staffId);
      else if (slot.label === "12:30") lunchAt1230.push(staffId);
      staffLunchDetails.set(staffId, slot);
      staffAssignedToSchoolLunch.add(staffId);
    };
    
    const amWorkEndMinute = 690;
    const firstSlotValidForAm = firstSlot.startMinute >= amWorkEndMinute;
    const secondSlotValidForAm = secondSlot.startMinute >= amWorkEndMinute;
    
    if (staffWithAm.length > 0 && staffWithoutAm.length > 0) {
      const pairs = Math.min(staffWithAm.length, staffWithoutAm.length);
      for (let i = 0; i < pairs; i++) {
        assignSchoolLunch(staffWithoutAm[i], firstSlot);
        if (secondSlotValidForAm) {
          assignSchoolLunch(staffWithAm[i], secondSlot);
        } else if (firstSlotValidForAm) {
          assignSchoolLunch(staffWithAm[i], firstSlot);
        } else {
          staffLunchTimes.set(staffWithAm[i], "12:00");
          lunchAt1200.push(staffWithAm[i]);
          staffAssignedToSchoolLunch.add(staffWithAm[i]);
        }
      }
      for (let i = pairs; i < staffWithoutAm.length; i++) {
        const slot = (i - pairs) % 2 === 0 ? firstSlot : secondSlot;
        assignSchoolLunch(staffWithoutAm[i], slot);
      }
      for (let i = pairs; i < staffWithAm.length; i++) {
        if (secondSlotValidForAm) {
          assignSchoolLunch(staffWithAm[i], (i - pairs) % 2 === 0 ? secondSlot : (firstSlotValidForAm ? firstSlot : secondSlot));
        } else {
          staffLunchTimes.set(staffWithAm[i], "12:00");
          lunchAt1200.push(staffWithAm[i]);
          staffAssignedToSchoolLunch.add(staffWithAm[i]);
        }
      }
    } else if (staffWithAm.length > 0) {
      const halfIndex = Math.ceil(staffWithAm.length / 2);
      for (let i = 0; i < staffWithAm.length; i++) {
        if (firstSlotValidForAm && secondSlotValidForAm) {
          const slot = i < halfIndex ? firstSlot : secondSlot;
          assignSchoolLunch(staffWithAm[i], slot);
        } else if (secondSlotValidForAm) {
          assignSchoolLunch(staffWithAm[i], secondSlot);
        } else if (firstSlotValidForAm) {
          assignSchoolLunch(staffWithAm[i], firstSlot);
        } else {
          staffLunchTimes.set(staffWithAm[i], "12:00");
          lunchAt1200.push(staffWithAm[i]);
          staffAssignedToSchoolLunch.add(staffWithAm[i]);
        }
      }
    } else {
      const halfIndex = Math.ceil(staffWithoutAm.length / 2);
      for (let i = 0; i < staffWithoutAm.length; i++) {
        const slot = i < halfIndex ? firstSlot : secondSlot;
        assignSchoolLunch(staffWithoutAm[i], slot);
      }
    }
  });
  
  // ============================================================================
  // COVERAGE-AWARE LUNCH ASSIGNMENT (for non-school staff)
  // ============================================================================
  // 
  // The key insight is that lunch assignments determine coverage availability:
  // - Staff eating at 11:30 → available to cover clients at 12:00
  // - Staff eating at 12:00 → available to cover clients at 11:30
  // 
  // Instead of assigning lunches arbitrarily and then trying to fix coverage,
  // we first analyze coverage needs and assign lunches to ensure feasibility.
  
  // Helper to get PM client start time in minutes from midnight
  const getPmClientStartMinute = (staffId: string): number | null => {
    const pmAssignment = pmAssignments.find(a => a.staffId === staffId && a.clientId);
    if (!pmAssignment || !pmAssignment.clientId) return null;
    
    const client = allClients?.find(c => c.id === pmAssignment.clientId);
    if (!client) return null;
    
    // Check client's schedule for the day
    const schedule = client.schedule as any;
    if (schedule && dayKey && schedule[dayKey]) {
      const daySchedule = schedule[dayKey];
      if (daySchedule.enabled && daySchedule.pmStart) {
        return timeStringToMinutes(daySchedule.pmStart);
      }
      // Handle simple format with start/end
      if (daySchedule.enabled && daySchedule.start) {
        const startMin = timeStringToMinutes(daySchedule.start);
        // If start is in PM range, use it
        if (startMin >= TIME_CONSTANTS.PM_BLOCK_START) {
          return startMin;
        }
      }
    }
    
    // Default PM start is 12:30 (750 minutes)
    return 750;
  };
  
  // Helper to get AM client for a staff member
  const getStaffAmClient = (staffId: string): string | null => {
    const amAssignment = amAssignments.find(a => a.staffId === staffId && a.clientId);
    return amAssignment?.clientId || null;
  };
  
  // Helper to assign lunch time
  const assignLunch = (staffId: string, time: LunchTime) => {
    staffLunchTimes.set(staffId, time);
    if (time === "11:00") lunchAt1100.push(staffId);
    else if (time === "11:30") lunchAt1130.push(staffId);
    else if (time === "12:00") lunchAt1200.push(staffId);
    else if (time === "12:30") lunchAt1230.push(staffId);
  };
  
  // Helper to check if a lunch time is blocked for staff
  const isTimeBlocked = (staffId: string, lunchTime: LunchTime): boolean => {
    const hasAm = amAssignments.some(a => a.staffId === staffId && a.clientId);
    const pmStartMinute = getPmClientStartMinute(staffId);
    
    // 11:00 lunch is blocked if staff has AM client (ends at 11:30)
    if (lunchTime === "11:00" && hasAm) return true;
    // 12:30 lunch is blocked if PM client starts before 1:00 PM (< 780 minutes)
    if (lunchTime === "12:30" && pmStartMinute !== null && pmStartMinute < 780) return true;
    
    return false;
  };
  
  // Helper to check if staff can provide coverage for a client (not restricted)
  const canStaffCoverClient = (staffId: string, clientId: string, originalStaffId: string): boolean => {
    if (!allClients || !allStaff) return true;
    const client = allClients.find(c => c.id === clientId);
    const staffMember = allStaff.find(s => s.id === staffId);
    if (!client || !staffMember) return false;
    
    // Original staff can always cover their own client
    if (staffId === originalStaffId) return true;
    
    // Check exclusions
    const excludedStaffIds = (client.excludedStaffIds as string[]) || [];
    if (excludedStaffIds.includes(staffId)) return false;
    
    const noLongerTrainedIds = (client.noLongerTrainedIds as string[]) || [];
    if (noLongerTrainedIds.includes(staffId)) return false;
    
    const lunchCoverageExcludedStaffIds = (client.lunchCoverageExcludedStaffIds as string[]) || [];
    if (lunchCoverageExcludedStaffIds.includes(staffId)) return false;
    
    // Check allowed lunch coverage list
    const lunchCoverageStaffIds = (client.lunchCoverageStaffIds as string[]) || [];
    if (lunchCoverageStaffIds.length > 0 && !lunchCoverageStaffIds.includes(staffId)) {
      return false;
    }
    
    return true;
  };
  
  // ============================================================================
  // PHASE 1: Identify clients needing coverage and their eligible cover staff
  // ============================================================================
  
  interface ClientCoverageInfo {
    clientId: string;
    originalStaffId: string;
    eligibleCoverStaff: string[]; // Staff who can legally cover this client
    splitLocationAt1200?: boolean; // True if this is a split-location client present at PM at 12:00
    pmLocationId?: string | null;  // PM location for split-location clients
    excludedStaffForSplit?: string; // AM staff excluded from covering at PM location
  }
  
  const clientsNeedingCoverage: ClientCoverageInfo[] = [];
  
  for (const assignment of amAssignments) {
    if (!assignment.clientId) continue;
    
    // Check if client needs lunch coverage (AM session extends to 11:30+)
    const client = allClients?.find(c => c.id === assignment.clientId);
    if (client && dayKey && !clientNeedsLunchCoverage(client, dayKey)) {
      continue; // Client leaves before lunch
    }
    
    // Skip unavailable clients
    if (unavailableClients?.has(assignment.clientId)) continue;
    
    // Check for split-location clients
    const middayStatus = getSplitClientMiddayStatus(
      assignment.clientId, amAssignments, pmAssignments, client, clientLocations
    );
    
    if (middayStatus.isSplitLocation) {
      // Split-location client: only include if they're present at PM location at 12:00
      if (middayStatus.presentAt1200 && middayStatus.pmStaffId) {
        // Client needs 12:00-12:30 coverage at PM location with PM staff as primary
        // Exclude the AM staff (they were at school, can't cover at clinic)
        clientsNeedingCoverage.push({
          clientId: assignment.clientId,
          originalStaffId: middayStatus.pmStaffId, // Use PM staff as the "original" for coverage
          eligibleCoverStaff: [],
          splitLocationAt1200: true,
          pmLocationId: middayStatus.pmLocationId,
          excludedStaffForSplit: assignment.staffId // AM staff can't cover at PM location
        });
      }
      // If not present at 12:00, skip entirely (still traveling)
      continue;
    }
    
    // Regular client - needs both 11:30-12:00 and 12:00-12:30 coverage
    clientsNeedingCoverage.push({
      clientId: assignment.clientId,
      originalStaffId: assignment.staffId,
      eligibleCoverStaff: []
    });
  }
  
  // ============================================================================
  // PHASE 2: Identify flexible staff and their constraints
  // ============================================================================
  
  interface StaffLunchConstraint {
    staffId: string;
    hasAm: boolean;
    hasPm: boolean;
    pmStartMinute: number | null;
    amClientId: string | null;
    blockedSlots: LunchTime[];
    preferredSlot: LunchTime | null;
    isFlexible: boolean; // Can be assigned to either 11:30 or 12:00
    isMandatory1230: boolean; // Must take 12:30 lunch
    isLead: boolean;
  }
  
  const staffConstraints: StaffLunchConstraint[] = [];
  const flexibleStaff: string[] = [];
  
  for (const staffId of activeStaffIds) {
    // Skip staff already assigned to school lunch slots
    if (staffAssignedToSchoolLunch.has(staffId)) continue;
    // Staff with noLunch constraint are excluded
    if (noLunchStaffIds.has(staffId)) continue;
    
    const hasAm = amAssignments.some(a => a.staffId === staffId && a.clientId);
    const hasPm = pmAssignments.some(a => a.staffId === staffId && a.clientId);
    const pmStartMinute = getPmClientStartMinute(staffId);
    const amClientId = getStaffAmClient(staffId);
    const isLead = leadRbtIds.has(staffId);
    
    const blockedSlots: LunchTime[] = [];
    if (isTimeBlocked(staffId, "11:00")) blockedSlots.push("11:00");
    if (isTimeBlocked(staffId, "11:30")) blockedSlots.push("11:30");
    if (isTimeBlocked(staffId, "12:00")) blockedSlots.push("12:00");
    if (isTimeBlocked(staffId, "12:30")) blockedSlots.push("12:30");
    
    // Check for mandatory 12:30 lunch (PM starts at 1:00+)
    const isMandatory1230 = hasPm && pmStartMinute !== null && pmStartMinute >= 780 && !noLateLunchStaffIds.has(staffId);
    
    // Leads have preferences but are still somewhat flexible
    let preferredSlot: LunchTime | null = null;
    if (isLead) {
      if (!hasPm && !blockedSlots.includes("12:30")) {
        preferredSlot = "12:30";
      } else if (!blockedSlots.includes("11:00")) {
        preferredSlot = "11:00";
      }
    }
    
    // Staff is flexible if they can take either 11:30 or 12:00
    const canTake1130 = !blockedSlots.includes("11:30");
    const canTake1200 = !blockedSlots.includes("12:00");
    const isFlexible = !isMandatory1230 && canTake1130 && canTake1200;
    
    staffConstraints.push({
      staffId,
      hasAm,
      hasPm,
      pmStartMinute,
      amClientId,
      blockedSlots,
      preferredSlot,
      isFlexible,
      isMandatory1230,
      isLead
    });
    
    if (isFlexible && !isLead) {
      flexibleStaff.push(staffId);
    }
  }
  
  // ============================================================================
  // PHASE 3: Build coverage eligibility matrix
  // ============================================================================
  
  // For each client, find which flexible staff can cover them
  for (const clientInfo of clientsNeedingCoverage) {
    for (const staffId of flexibleStaff) {
      // Staff can't cover their own client during lunch (they need to eat!)
      if (staffId === clientInfo.originalStaffId) continue;
      
      // For split-location clients at 12:00, exclude the AM staff (they were at school)
      if (clientInfo.excludedStaffForSplit && staffId === clientInfo.excludedStaffForSplit) continue;
      
      if (canStaffCoverClient(staffId, clientInfo.clientId, clientInfo.originalStaffId)) {
        clientInfo.eligibleCoverStaff.push(staffId);
      }
    }
  }
  
  // ============================================================================
  // PHASE 4: Assign mandatory lunch times first
  // ============================================================================
  
  for (const constraint of staffConstraints) {
    if (constraint.isMandatory1230) {
      assignLunch(constraint.staffId, "12:30");
    }
  }
  
  // ============================================================================
  // PHASE 5: Assign leads with preferences (respecting blocked slots)
  // ============================================================================
  
  const leadsAssigned: { staffId: string; slot: LunchTime }[] = [];
  for (const constraint of staffConstraints) {
    if (constraint.isLead && !constraint.isMandatory1230) {
      // Get available slots for this lead
      const can1100 = !constraint.blockedSlots.includes("11:00");
      const can1130 = !constraint.blockedSlots.includes("11:30");
      const can1200 = !constraint.blockedSlots.includes("12:00");
      const can1230 = !constraint.blockedSlots.includes("12:30");
      
      let slot: LunchTime;
      
      // Check if preferred slot is available
      if (constraint.preferredSlot && !constraint.blockedSlots.includes(constraint.preferredSlot)) {
        slot = constraint.preferredSlot;
      } else {
        // Fallback logic based on availability
        if (constraint.hasAm) {
          // Has AM client: prefer 11:30, then 12:00, then 12:30
          if (can1130) slot = "11:30";
          else if (can1200) slot = "12:00";
          else if (can1230) slot = "12:30";
          else slot = "11:30"; // All blocked, use default (shouldn't happen)
        } else {
          // No AM client: prefer 12:00, then 11:30, then 11:00
          if (can1200) slot = "12:00";
          else if (can1130) slot = "11:30";
          else if (can1100) slot = "11:00";
          else slot = "12:00"; // All blocked, use default (shouldn't happen)
        }
      }
      
      assignLunch(constraint.staffId, slot);
      leadsAssigned.push({ staffId: constraint.staffId, slot });
    }
  }
  
  // ============================================================================
  // PHASE 6: Coverage-aware assignment for flexible staff
  // ============================================================================
  // 
  // The goal is to ensure each client has at least one eligible cover staff
  // at the appropriate slot:
  // - If client's staff takes lunch at 11:30 → client needs 11:30 coverage from staff eating at 12:00
  // - If client's staff takes lunch at 12:00 → client needs 12:00 coverage from staff eating at 11:30
  // 
  // We use a greedy approach: prioritize assigning staff to slots where their
  // coverage is most critically needed.
  
  // Track which slot each client's original staff will take
  // (we'll determine this as we go)
  const clientOriginalStaffSlot = new Map<string, LunchTime>();
  
  // Count how many eligible cover staff would be at each slot for each client
  const countCoverageIfAssigned = (clientInfo: ClientCoverageInfo, staffSlotAssignments: Map<string, LunchTime>): { at1130: number; at1200: number } => {
    let at1130 = 0; // Staff eating at 12:00 can cover at 11:30
    let at1200 = 0; // Staff eating at 11:30 can cover at 12:00
    
    for (const eligibleStaffId of clientInfo.eligibleCoverStaff) {
      const slot = staffSlotAssignments.get(eligibleStaffId);
      if (slot === "12:00") at1130++; // Eating at 12:00 means covering 11:30
      else if (slot === "11:30") at1200++; // Eating at 11:30 means covering 12:00
    }
    
    return { at1130, at1200 };
  };
  
  // Tentative assignments for flexible staff
  const tentativeAssignments = new Map<string, LunchTime>();
  
  // Copy over already-assigned staff
  staffLunchTimes.forEach((slot, staffId) => {
    tentativeAssignments.set(staffId, slot);
  });
  
  // Sort clients by how restricted their coverage options are (most restricted first)
  const sortedClients = [...clientsNeedingCoverage].sort((a, b) => {
    return a.eligibleCoverStaff.length - b.eligibleCoverStaff.length;
  });
  
  // For each client, determine what slot the original staff should take
  // to maximize coverage options
  for (const clientInfo of sortedClients) {
    const originalStaffId = clientInfo.originalStaffId;
    const constraint = staffConstraints.find(c => c.staffId === originalStaffId);
    
    if (!constraint || constraint.isMandatory1230 || tentativeAssignments.has(originalStaffId)) {
      continue;
    }
    
    // Check which slots are actually available for this staff
    const can1130 = !constraint.blockedSlots.includes("11:30");
    const can1200 = !constraint.blockedSlots.includes("12:00");
    
    // If only one slot is available, use it
    if (can1130 && !can1200) {
      tentativeAssignments.set(originalStaffId, "11:30");
      clientOriginalStaffSlot.set(clientInfo.clientId, "11:30");
      continue;
    }
    if (can1200 && !can1130) {
      tentativeAssignments.set(originalStaffId, "12:00");
      clientOriginalStaffSlot.set(clientInfo.clientId, "12:00");
      continue;
    }
    if (!can1130 && !can1200) {
      // Both blocked - this shouldn't happen for flexible staff, but handle gracefully
      continue;
    }
    
    // Both slots available - simulate coverage for each choice by counting potential
    // coverage from eligible staff who could still be assigned to either slot
    // 
    // Key insight: We need to count how many eligible cover staff COULD provide coverage
    // at each slot, not just how many are already assigned. This includes unassigned staff.
    
    let potentialCoverAt1130 = 0; // Staff who could eat at 12:00 and cover 11:30
    let potentialCoverAt1200 = 0; // Staff who could eat at 11:30 and cover 12:00
    
    for (const eligibleStaffId of clientInfo.eligibleCoverStaff) {
      const existingSlot = tentativeAssignments.get(eligibleStaffId);
      
      if (existingSlot) {
        // Already assigned - count based on actual assignment
        if (existingSlot === "12:00") potentialCoverAt1130++;
        else if (existingSlot === "11:30") potentialCoverAt1200++;
      } else {
        // Not yet assigned - check what slots they can take
        const eligibleConstraint = staffConstraints.find(c => c.staffId === eligibleStaffId);
        if (eligibleConstraint) {
          const canEat1130 = !eligibleConstraint.blockedSlots.includes("11:30");
          const canEat1200 = !eligibleConstraint.blockedSlots.includes("12:00");
          
          // Count potential coverage (staff eating at 12:00 cover 11:30, eating at 11:30 cover 12:00)
          if (canEat1200) potentialCoverAt1130++; // Could eat at 12:00 → cover 11:30
          if (canEat1130) potentialCoverAt1200++; // Could eat at 11:30 → cover 12:00
        }
      }
    }
    
    // Prefer the slot where client has more potential coverage options
    let preferredOriginalSlot: LunchTime;
    if (potentialCoverAt1130 > potentialCoverAt1200) {
      // More staff can cover at 11:30, so original should take 11:30 (needing 11:30 coverage)
      preferredOriginalSlot = "11:30";
    } else if (potentialCoverAt1200 > potentialCoverAt1130) {
      // More staff can cover at 12:00, so original should take 12:00 (needing 12:00 coverage)
      preferredOriginalSlot = "12:00";
    } else {
      // Equal coverage potential - use default logic
      preferredOriginalSlot = constraint.hasAm ? "11:30" : "12:00";
    }
    
    tentativeAssignments.set(originalStaffId, preferredOriginalSlot);
    clientOriginalStaffSlot.set(clientInfo.clientId, preferredOriginalSlot);
  }
  
  // ============================================================================
  // PHASE 7: Assign remaining flexible staff to balance coverage
  // ============================================================================
  
  // Get clients whose original staff take each slot and need coverage
  const clientsNeedingCoverageAt1130: ClientCoverageInfo[] = [];
  const clientsNeedingCoverageAt1200: ClientCoverageInfo[] = [];
  
  for (const clientInfo of clientsNeedingCoverage) {
    const originalSlot = tentativeAssignments.get(clientInfo.originalStaffId) || clientOriginalStaffSlot.get(clientInfo.clientId);
    if (originalSlot === "11:30") {
      clientsNeedingCoverageAt1130.push(clientInfo);
    } else if (originalSlot === "12:00") {
      clientsNeedingCoverageAt1200.push(clientInfo);
    }
  }
  
  // Assign remaining flexible staff to maximize coverage
  for (const staffId of flexibleStaff) {
    if (tentativeAssignments.has(staffId)) continue;
    
    const constraint = staffConstraints.find(c => c.staffId === staffId);
    if (!constraint) continue;
    
    // Check which slots are actually available for this staff
    const can1130 = !constraint.blockedSlots.includes("11:30");
    const can1200 = !constraint.blockedSlots.includes("12:00");
    
    // If only one slot is available, use it
    if (can1130 && !can1200) {
      tentativeAssignments.set(staffId, "11:30");
      continue;
    }
    if (can1200 && !can1130) {
      tentativeAssignments.set(staffId, "12:00");
      continue;
    }
    if (!can1130 && !can1200) {
      // Both blocked - skip this staff for now, they'll be handled in Phase 8
      continue;
    }
    
    // Both slots available - count how many uncovered clients this staff could help
    let helpAt1130 = 0; // If staff eats at 12:00, they cover 11:30
    let helpAt1200 = 0; // If staff eats at 11:30, they cover 12:00
    
    for (const clientInfo of clientsNeedingCoverageAt1130) {
      if (clientInfo.eligibleCoverStaff.includes(staffId)) {
        // Check if client already has coverage at 11:30
        const currentCoverage = countCoverageIfAssigned(clientInfo, tentativeAssignments);
        if (currentCoverage.at1130 === 0) helpAt1130++;
      }
    }
    
    for (const clientInfo of clientsNeedingCoverageAt1200) {
      if (clientInfo.eligibleCoverStaff.includes(staffId)) {
        // Check if client already has coverage at 12:00
        const currentCoverage = countCoverageIfAssigned(clientInfo, tentativeAssignments);
        if (currentCoverage.at1200 === 0) helpAt1200++;
      }
    }
    
    // Assign to slot where this staff provides most value
    let assignedSlot: LunchTime;
    if (helpAt1130 > helpAt1200) {
      assignedSlot = "12:00"; // Eat at 12:00 to cover 11:30
    } else if (helpAt1200 > helpAt1130) {
      assignedSlot = "11:30"; // Eat at 11:30 to cover 12:00
    } else {
      // Equal need - use default logic based on AM/PM
      assignedSlot = constraint.hasAm ? "11:30" : "12:00";
    }
    
    tentativeAssignments.set(staffId, assignedSlot);
  }
  
  // ============================================================================
  // PHASE 8: Finalize all tentative assignments
  // ============================================================================
  
  tentativeAssignments.forEach((slot, staffId) => {
    if (!staffLunchTimes.has(staffId)) {
      assignLunch(staffId, slot);
    }
  });
  
  // Assign any remaining staff who weren't handled (shouldn't happen, but safety net)
  for (const constraint of staffConstraints) {
    if (!staffLunchTimes.has(constraint.staffId) && !constraint.isMandatory1230) {
      // Check blocked slots before assigning
      const can1130 = !constraint.blockedSlots.includes("11:30");
      const can1200 = !constraint.blockedSlots.includes("12:00");
      
      let defaultSlot: LunchTime;
      if (can1130 && can1200) {
        defaultSlot = constraint.hasAm ? "11:30" : "12:00";
      } else if (can1130) {
        defaultSlot = "11:30";
      } else if (can1200) {
        defaultSlot = "12:00";
      } else {
        // Both blocked - try 11:00 or 12:30 as fallback
        if (!constraint.blockedSlots.includes("11:00")) {
          defaultSlot = "11:00";
        } else if (!constraint.blockedSlots.includes("12:30")) {
          defaultSlot = "12:30";
        } else {
          // All blocked - use default anyway (shouldn't happen)
          defaultSlot = constraint.hasAm ? "11:30" : "12:00";
        }
      }
      assignLunch(constraint.staffId, defaultSlot);
    }
  }
  
  return { lunchAt1100, lunchAt1130, lunchAt1200, lunchAt1230, staffLunchTimes, staffLunchDetails, schoolLunchWindows };
}

// Helper to check if staff is RESTRICTED from a client for LUNCH COVERAGE purposes
// This checks exclusions and restrictions that prevent lunch coverage
// 
// IMPORTANT: Lunch coverage is fundamentally different from substitute sessions:
// - Lunch coverage is temporary supervision (30 minutes) while the original staff eats
// - Substitute sessions replace the original staff for an entire AM or PM block
// - Therefore, allowSub=false should NOT block lunch coverage
// 
// originalStaffId: if the staff is the original assigned staff for the client, they can always cover
// lunchPeerContext: if provided, contains staffOwnsClientId for lunch peer grouping context
export function isStaffRestrictedFromClient(
  staffId: string,
  clientId: string,
  allClients: Client[],
  allStaff: Staff[],
  originalStaffId?: string,
  lunchPeerContext?: { staffOwnsClientId?: string }
): boolean {
  const client = allClients.find(c => c.id === clientId);
  const staffMember = allStaff.find(s => s.id === staffId);
  if (!client || !staffMember) return false;
  
  // Check exclusions - these apply to everyone including original staff
  const excludedStaffIds = (client.excludedStaffIds as string[]) || [];
  if (excludedStaffIds.includes(staffId)) return true;
  
  const noLongerTrainedIds = (client.noLongerTrainedIds as string[]) || [];
  if (noLongerTrainedIds.includes(staffId)) return true;
  
  // Check lunch coverage specific restrictions - apply to everyone
  const lunchCoverageExcludedStaffIds = (client.lunchCoverageExcludedStaffIds as string[]) || [];
  if (lunchCoverageExcludedStaffIds.includes(staffId)) return true;
  
  // Non-original staff additional checks (for lunch coverage, NOT for full session substitution)
  const isOriginalStaff = staffId === originalStaffId;
  if (!isOriginalStaff) {
    // Check if staff is in the allowed lunch coverage list (if specified)
    // This is the primary control for who can provide lunch coverage
    const lunchCoverageStaffIds = (client.lunchCoverageStaffIds as string[]) || [];
    if (lunchCoverageStaffIds.length > 0 && !lunchCoverageStaffIds.includes(staffId)) {
      return true; // Restricted - not in allowed list
    }
    
    // NOTE: We intentionally do NOT check allowSub here because:
    // - Lunch coverage is temporary supervision, not a substitute session
    // - allowSub is meant to prevent full AM/PM session substitutions
    // - If the clinic wants to restrict lunch coverage, they use lunchCoverageStaffIds
  }
  
  return false;
}

export function isStaffTrainedForClient(
  staffId: string,
  clientId: string,
  allClients: Client[],
  allStaff: Staff[]
): boolean {
  const client = allClients.find(c => c.id === clientId);
  const staffMember = allStaff.find(s => s.id === staffId);
  if (!client || !staffMember) return false;
  
  const focusStaffIds = (client.focusStaffIds as string[]) || [];
  const trainedStaffIds = (client.trainedStaffIds as string[]) || [];
  const allowedFloatRbtIds = (client.allowedFloatRbtIds as string[]) || [];
  const allowedLeadRbtIds = (client.allowedLeadRbtIds as string[]) || [];
  const floatRbtsAllowed = client.floatRbtsAllowed as boolean;
  const leadRbtsAllowed = client.leadRbtsAllowed as boolean;
  
  if (focusStaffIds.includes(staffId)) return true;
  if (trainedStaffIds.includes(staffId)) return true;
  
  if (staffMember.role === 'Float') {
    if (floatRbtsAllowed && allowedFloatRbtIds.includes(staffId)) return true;
  }
  
  if (staffMember.role === 'Lead RBT') {
    if (leadRbtsAllowed && allowedLeadRbtIds.includes(staffId)) return true;
  }
  
  return false;
}

// REVISED RULE: Staff can cover group if NOT RESTRICTED from ANY client
// The previous "trained on at least ONE client" requirement was too strict for lunch coverage
// During lunch, we primarily need supervision, not full training authorization
export function canStaffCoverGroupForLunch(
  staffId: string,
  clientsWithOrigin: Array<{ clientId: string, originalStaffId?: string }>,
  allClients: Client[],
  allStaff: Staff[]
): boolean {
  if (clientsWithOrigin.length === 0) return true;
  
  // Find what client this covering staff owns (if any) in the group
  // This is used for the lunch peer exception to allowSub
  const staffOwnClient = clientsWithOrigin.find(c => c.originalStaffId === staffId);
  const staffOwnsClientId = staffOwnClient?.clientId;
  
  // Check if staff is restricted from ANY client in the group
  // If not restricted from any, they can provide lunch coverage
  for (const { clientId, originalStaffId } of clientsWithOrigin) {
    // Pass the lunch peer context so allowSub can be bypassed when appropriate
    const lunchPeerContext = staffOwnsClientId ? { staffOwnsClientId } : undefined;
    if (isStaffRestrictedFromClient(staffId, clientId, allClients, allStaff, originalStaffId, lunchPeerContext)) {
      return false;
    }
  }
  
  // If not restricted from any client, staff can provide lunch coverage
  // Training authorization is preferred but not required for lunch supervision
  return true;
}

export function buildLunchCoverage(
  lunchGroups: LunchGroup,
  amAssignments: LocalTemplateAssignment[],
  pmAssignments: LocalTemplateAssignment[],
  allClients: Client[],
  allStaff: Staff[],
  unavailableClients: Set<string>,
  dayKey?: string
): LunchCoverageResult {
  const errors: LunchCoverageError[] = [];
  const slot1100Coverage = new Map<string, CoverageEntry>();
  const slot1130Coverage = new Map<string, CoverageEntry>();
  const slot1200Coverage = new Map<string, CoverageEntry>();
  const slot1230Coverage = new Map<string, CoverageEntry>();
  
  const updatedLunchGroups: LunchGroup = {
    lunchAt1100: [...lunchGroups.lunchAt1100],
    lunchAt1130: [...lunchGroups.lunchAt1130],
    lunchAt1200: [...lunchGroups.lunchAt1200],
    lunchAt1230: [...lunchGroups.lunchAt1230],
    staffLunchTimes: new Map(lunchGroups.staffLunchTimes),
    staffLunchDetails: new Map(lunchGroups.staffLunchDetails),
    schoolLunchWindows: new Map(lunchGroups.schoolLunchWindows)
  };

  const getClientNeed = (clientId: string, originalStaffId: string, excludedStaffForSplit?: string): ClientCoverageNeed | null => {
    const client = allClients.find(c => c.id === clientId);
    if (!client || unavailableClients.has(clientId)) return null;
    return {
      clientId,
      clientName: client.name,
      originalStaffId,
      canBeGrouped: client.canBeGrouped as boolean,
      allowedLunchPeerIds: (client.allowedLunchPeerIds as string[]) || [],
      noFirstLunchPeerIds: (client.noFirstLunchPeerIds as string[]) || [],
      noSecondLunchPeerIds: (client.noSecondLunchPeerIds as string[]) || [],
      allowGroupsOf3: client.allowGroupsOf3 as boolean,
      allowGroupsOf4: client.allowGroupsOf4 as boolean,
      disallowedGroupCombos: (client.disallowedGroupCombos as string[]) || [],
      isGroupLeader: client.isGroupLeader as boolean,
      groupLeaderName: client.groupLeaderName as string | null,
      groupLeaderNameFirstLunch: client.groupLeaderNameFirstLunch as string | null,
      groupLeaderNameSecondLunch: client.groupLeaderNameSecondLunch as string | null,
      excludedStaffForSplit
    };
  };

  const toClientNeed = (cid: string): ClientCoverageNeed => {
    const c = allClients.find(cl => cl.id === cid);
    return {
      clientId: cid,
      clientName: c?.name || '',
      originalStaffId: '',
      canBeGrouped: c?.canBeGrouped as boolean || false,
      allowedLunchPeerIds: (c?.allowedLunchPeerIds as string[]) || [],
      noFirstLunchPeerIds: (c?.noFirstLunchPeerIds as string[]) || [],
      noSecondLunchPeerIds: (c?.noSecondLunchPeerIds as string[]) || [],
      allowGroupsOf3: c?.allowGroupsOf3 as boolean || false,
      allowGroupsOf4: c?.allowGroupsOf4 as boolean || false,
      disallowedGroupCombos: (c?.disallowedGroupCombos as string[]) || [],
      isGroupLeader: c?.isGroupLeader as boolean || false,
      groupLeaderName: c?.groupLeaderName as string | null || null,
      groupLeaderNameFirstLunch: c?.groupLeaderNameFirstLunch as string | null || null,
      groupLeaderNameSecondLunch: c?.groupLeaderNameSecondLunch as string | null || null
    };
  };

  // Map LunchTime to LunchSlot for slot-specific pairing restrictions
  const getLunchSlot = (lunchTime: LunchTime): LunchSlot => {
    // 11:00 and 11:30 are "first" lunch slots (11:30-12:00 coverage)
    // 12:00 and 12:30 are "second" lunch slots (12:00-12:30 coverage)
    return (lunchTime === "11:00" || lunchTime === "11:30") ? "first" : "second";
  };

  const assignCoverage = (
    clientsNeedingCoverage: ClientCoverageNeed[],
    coveringStaffIds: string[],
    lunchSlot: LunchTime,
    coverageMap: Map<string, CoverageEntry>
  ): ClientCoverageNeed[] => {
    const pairingSlot = getLunchSlot(lunchSlot);
    
    for (const staffId of coveringStaffIds) {
      if (!coverageMap.has(staffId)) {
        coverageMap.set(staffId, createEmptyCoverage());
      }
    }

    const ownClients = new Map<string, ClientCoverageNeed[]>();
    for (const staffId of coveringStaffIds) {
      ownClients.set(staffId, []);
    }

    const lunchingStaffClients: ClientCoverageNeed[] = [];
    for (const need of clientsNeedingCoverage) {
      if (coveringStaffIds.includes(need.originalStaffId)) {
        const list = ownClients.get(need.originalStaffId) || [];
        list.push(need);
        ownClients.set(need.originalStaffId, list);
      } else {
        lunchingStaffClients.push(need);
      }
    }

    ownClients.forEach((clients, staffId) => {
      const coverage = coverageMap.get(staffId)!;
      for (const client of clients) {
        if (!coverage.clientIds.includes(client.clientId)) {
          const existingNeeds = coverage.clientIds.map(toClientNeed);
          if (existingNeeds.length === 0 || canAddToGroup(existingNeeds, client, pairingSlot)) {
            coverage.clientIds.push(client.clientId);
            coverage.clientNames.push(client.clientName);
            coverage.clientOriginalStaff.set(client.clientId, client.originalStaffId);
          }
        }
      }
    });

    const unassigned: ClientCoverageNeed[] = [];
    for (const need of lunchingStaffClients) {
      let assigned = false;

      for (const staffId of coveringStaffIds) {
        // Skip excluded staff for split-location clients (AM staff can't cover at PM location)
        if (need.excludedStaffForSplit && staffId === need.excludedStaffForSplit) {
          continue;
        }
        
        const coverage = coverageMap.get(staffId)!;
        const existingClientIds = coverage.clientIds;
        
        const proposedGroupWithOrigin: Array<{ clientId: string, originalStaffId?: string }> = 
          existingClientIds.map(cid => ({
            clientId: cid,
            originalStaffId: coverage.clientOriginalStaff.get(cid)
          }));
        proposedGroupWithOrigin.push({
          clientId: need.clientId,
          originalStaffId: need.originalStaffId
        });
        
        if (!canStaffCoverGroupForLunch(staffId, proposedGroupWithOrigin, allClients, allStaff)) {
          continue;
        }
        
        const existingNeeds = existingClientIds.map(toClientNeed);

        if (existingNeeds.length === 0) {
          coverage.clientIds.push(need.clientId);
          coverage.clientNames.push(need.clientName);
          coverage.clientOriginalStaff.set(need.clientId, need.originalStaffId);
          assigned = true;
          break;
        }

        if (canAddToGroup(existingNeeds, need, pairingSlot)) {
          coverage.clientIds.push(need.clientId);
          coverage.clientNames.push(need.clientName);
          coverage.clientOriginalStaff.set(need.clientId, need.originalStaffId);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        unassigned.push(need);
      }
    }

    return unassigned;
  };

  // Separate needs for regular clients vs split-location clients
  const amClientNeeds: ClientCoverageNeed[] = [];
  const splitLocationNeeds1200: ClientCoverageNeed[] = []; // Split clients only need 12:00 coverage
  
  for (const assignment of amAssignments) {
    if (assignment.clientId) {
      // Check if client's AM session extends into lunch period
      const client = allClients.find(c => c.id === assignment.clientId);
      if (client && dayKey && !clientNeedsLunchCoverage(client, dayKey)) {
        // Client's AM session ends before 11:30 - they don't need lunch coverage
        continue;
      }
      
      // Check for split-location clients
      const middayStatus = getSplitClientMiddayStatus(
        assignment.clientId, amAssignments, pmAssignments, client, undefined
      );
      
      if (middayStatus.isSplitLocation) {
        // Split-location client: only include if they're present at PM location at 12:00
        if (middayStatus.presentAt1200 && middayStatus.pmStaffId) {
          // Use PM staff as the original for coverage purposes
          // Exclude AM staff from covering (they were at school, can't cover at clinic)
          const need = getClientNeed(assignment.clientId, middayStatus.pmStaffId, assignment.staffId);
          if (need) splitLocationNeeds1200.push(need);
        }
        // Skip entirely for 11:30 coverage (still at school or traveling)
        continue;
      }
      
      const need = getClientNeed(assignment.clientId, assignment.staffId);
      if (need) amClientNeeds.push(need);
    }
  }

  const unassigned1130 = assignCoverage(amClientNeeds, updatedLunchGroups.lunchAt1200, "11:30", slot1130Coverage);
  // Combine regular clients and split-location clients for 12:00 slot
  const allNeeds1200 = [...amClientNeeds, ...splitLocationNeeds1200];
  const unassigned1200 = assignCoverage(allNeeds1200, updatedLunchGroups.lunchAt1130, "12:00", slot1200Coverage);

  for (const need of [...unassigned1130, ...unassigned1200]) {
    const slot = unassigned1130.includes(need) ? "11:30" : "12:00";
    errors.push({
      clientId: need.clientId,
      clientName: need.clientName,
      lunchSlot: slot as LunchTime,
      reason: `No legal lunch coverage available`
    });
  }

  return { 
    slot1100Coverage, 
    slot1130Coverage, 
    slot1200Coverage, 
    slot1230Coverage, 
    errors,
    updatedLunchGroups
  };
}

export { canGroupClients, canAddToGroup };
