/**
 * Client Utilities Module
 * 
 * Consolidated client availability and constraint checking utilities.
 * This module provides a single source of truth for client-related checks
 * used throughout the scheduling engine.
 */

import type { Client } from "./types";
import type { Exception } from "../daily-run-data";
import { timeStringToMinutes, timeRangesOverlap, TIME_CONSTANTS } from "./time-utils";

/**
 * Checks if a client is available (not in the unavailable set).
 */
export function isClientAvailable(
  clientId: string | null | undefined, 
  unavailableClients: Set<string>
): boolean {
  if (!clientId) return false;
  return !unavailableClients.has(clientId);
}

/**
 * Builds a Set of client IDs that are unavailable for the full day.
 * This includes clients with all-day OUT or CANCELLED exceptions.
 */
export function buildFullDayUnavailableClientsSet(exceptions: Exception[]): Set<string> {
  return new Set(
    exceptions
      .filter(e => 
        e.type === "client" && 
        ((e.mode === "out" && e.allDay) || e.mode === "cancelled")
      )
      .map(e => e.entityId)
  );
}

/**
 * Builds a Set of client IDs that are unavailable during the lunch window (11:00-12:30).
 * This includes:
 * - All-day OUT clients
 * - CANCELLED clients
 * - Partial OUT clients whose time window overlaps with lunch
 */
export function buildLunchUnavailableClientsSet(exceptions: Exception[]): Set<string> {
  return new Set(
    exceptions
      .filter(e => {
        if (e.type !== "client") return false;
        if (e.mode === "cancelled") return true;
        if (e.mode !== "out") return false;
        
        // All-day OUT clients are unavailable for lunch
        if (e.allDay) return true;
        
        // For partial OUT, check if timeWindow overlaps with lunch period
        if (e.timeWindow) {
          const outStart = timeStringToMinutes(e.timeWindow.start);
          const outEnd = timeStringToMinutes(e.timeWindow.end);
          
          // Check overlap with lunch window (11:00-12:30)
          if (timeRangesOverlap(
            outStart, 
            outEnd, 
            TIME_CONSTANTS.LUNCH_FIRST_SLOT, 
            TIME_CONSTANTS.LUNCH_FOURTH_SLOT
          )) {
            return true;
          }
        }
        
        return false;
      })
      .map(e => e.entityId)
  );
}

/**
 * Builds a Set of staff IDs that are OUT.
 */
export function buildOutStaffSet(exceptions: Exception[]): Set<string> {
  return new Set(
    exceptions
      .filter(e => e.type === "staff" && e.mode === "out")
      .map(e => e.entityId)
  );
}

/**
 * Gets client's staffing constraint arrays.
 */
export function getClientStaffingConstraints(client: Client): {
  excludedStaffIds: string[];
  noLongerTrainedIds: string[];
  trainedStaffIds: string[];
  allowedFloatRbtIds: string[];
  allowedLeadRbtIds: string[];
  focusStaffIds: string[];
  allowSub: boolean;
} {
  return {
    excludedStaffIds: (client.excludedStaffIds as string[]) || [],
    noLongerTrainedIds: (client.noLongerTrainedIds as string[]) || [],
    trainedStaffIds: (client.trainedStaffIds as string[]) || [],
    allowedFloatRbtIds: (client.allowedFloatRbtIds as string[]) || [],
    allowedLeadRbtIds: (client.allowedLeadRbtIds as string[]) || [],
    focusStaffIds: (client.focusStaffIds as string[]) || [],
    allowSub: client.allowSub === true,
  };
}

/**
 * Checks if a staff member is allowed to work with a client.
 */
export function isStaffAllowedForClient(
  staffId: string,
  client: Client,
  staffRole: string
): boolean {
  const constraints = getClientStaffingConstraints(client);
  
  // Check exclusions first (never allowed)
  if (constraints.excludedStaffIds.includes(staffId)) return false;
  if (constraints.noLongerTrainedIds.includes(staffId)) return false;
  
  // Check if staff is in focus or trained lists
  if (constraints.focusStaffIds.includes(staffId)) return true;
  if (constraints.trainedStaffIds.includes(staffId)) return true;
  
  // Floats must be allowed AND in the list
  if (staffRole === 'Float') {
    return client.floatRbtsAllowed === true && constraints.allowedFloatRbtIds.includes(staffId);
  }
  
  // Subs require allowSub flag AND explicit approval via the approval system
  // This function returns false for subs - the approval workflow handles sub eligibility
  // Do NOT return true here just because allowSub is set
  
  // Leads must be allowed AND in the list
  if (staffRole === 'Lead RBT') {
    return client.leadRbtsAllowed === true && constraints.allowedLeadRbtIds.includes(staffId);
  }
  
  return false;
}

/**
 * Checks if client can be grouped with others during lunch.
 */
export function canClientBeGrouped(client: Client): boolean {
  return client.canBeGrouped === true;
}

/**
 * Gets client's lunch pairing restrictions.
 */
export function getClientLunchPairingRestrictions(client: Client): {
  allowedLunchPeerIds: string[];
  noFirstLunchPeerIds: string[];
  noSecondLunchPeerIds: string[];
  allowGroupsOf3: boolean;
  allowGroupsOf4: boolean;
} {
  return {
    allowedLunchPeerIds: (client.allowedLunchPeerIds as string[]) || [],
    noFirstLunchPeerIds: (client.noFirstLunchPeerIds as string[]) || [],
    noSecondLunchPeerIds: (client.noSecondLunchPeerIds as string[]) || [],
    allowGroupsOf3: client.allowGroupsOf3 === true,
    allowGroupsOf4: client.allowGroupsOf4 === true,
  };
}

/**
 * Gets the client's initials for display.
 */
export function getClientInitials(clientName: string): string {
  const parts = clientName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clientName.substring(0, 2).toUpperCase();
}

/**
 * Checks if a client has the cancelAllDayOnly flag.
 */
export function isCancelAllDayOnly(client: Client): boolean {
  return client.cancelAllDayOnly === true;
}

/**
 * Note: Client cancel links are stored in a separate table (clientCancelLinks).
 * Use the getCancelLinksForClient function from the API to retrieve them.
 */

/**
 * Client session times for a specific day.
 */
export interface ClientSessionTimes {
  amStart: number | null;
  amEnd: number | null;
  pmStart: number | null;
  pmEnd: number | null;
  enabled: boolean;
}

/**
 * Gets a client's session times for a specific day from their schedule.
 * Returns the start and end times in minutes from midnight for AM and PM blocks.
 * 
 * The client schedule can have different structures:
 * - Simple: { start: "8:00", end: "11:00", enabled: true } (single session)
 * - Full: { amStart: "8:00", amEnd: "11:30", pmStart: "12:30", pmEnd: "4:00", enabled: true }
 * 
 * @param client - The client object
 * @param dayKey - The day key ('mon', 'tue', 'wed', 'thu', 'fri')
 * @returns Session times for AM and PM blocks, or null values if not scheduled
 */
export function getClientSessionTimes(client: Client, dayKey: string): ClientSessionTimes {
  const schedule = client.schedule as any;
  
  if (!schedule || !schedule[dayKey]) {
    return { amStart: null, amEnd: null, pmStart: null, pmEnd: null, enabled: false };
  }
  
  const daySchedule = schedule[dayKey];
  if (!daySchedule.enabled) {
    return { amStart: null, amEnd: null, pmStart: null, pmEnd: null, enabled: false };
  }
  
  // Handle simple schedule format (single session with start/end)
  if (daySchedule.start !== undefined && daySchedule.end !== undefined) {
    const startMinute = timeStringToMinutes(daySchedule.start);
    const endMinute = timeStringToMinutes(daySchedule.end);
    
    // Determine if this is AM-only, PM-only, or spans both based on times
    // AM block is typically before 12:30 (750 minutes)
    // PM block is typically after 12:00 (720 minutes)
    const isAmSession = startMinute < TIME_CONSTANTS.PM_BLOCK_START; // Before 12:30
    const isPmSession = endMinute > TIME_CONSTANTS.LUNCH_FOURTH_SLOT; // After 12:30
    
    return {
      amStart: isAmSession ? startMinute : null,
      amEnd: isAmSession ? Math.min(endMinute, TIME_CONSTANTS.PM_BLOCK_START) : null,
      pmStart: isPmSession ? Math.max(startMinute, TIME_CONSTANTS.PM_BLOCK_START) : null,
      pmEnd: isPmSession ? endMinute : null,
      enabled: true
    };
  }
  
  // Handle full schedule format (separate AM/PM fields)
  return {
    amStart: daySchedule.amStart ? timeStringToMinutes(daySchedule.amStart) : null,
    amEnd: daySchedule.amEnd ? timeStringToMinutes(daySchedule.amEnd) : null,
    pmStart: daySchedule.pmStart ? timeStringToMinutes(daySchedule.pmStart) : null,
    pmEnd: daySchedule.pmEnd ? timeStringToMinutes(daySchedule.pmEnd) : null,
    enabled: true
  };
}

/**
 * Checks if a client's AM session extends into the lunch period (11:30+).
 * A client needs lunch coverage only if their AM session ends at or after 11:30.
 * 
 * @param client - The client object
 * @param dayKey - The day key ('mon', 'tue', 'wed', 'thu', 'fri')
 * @returns true if the client needs lunch coverage, false if they leave before lunch
 */
export function clientNeedsLunchCoverage(client: Client, dayKey: string): boolean {
  const times = getClientSessionTimes(client, dayKey);
  
  // If client is not scheduled this day, no coverage needed
  if (!times.enabled) {
    return false;
  }
  
  // If no AM session at all (PM-only client), they don't need lunch coverage
  // because they arrive after the lunch period
  if (times.amStart === null && times.amEnd === null) {
    return false;
  }
  
  // If AM end time is set, check if it extends into lunch (11:30+)
  if (times.amEnd !== null) {
    return times.amEnd >= TIME_CONSTANTS.LUNCH_SECOND_SLOT; // 690 = 11:30
  }
  
  // Fallback: if we have AM start but somehow no AM end, assume coverage needed
  return true;
}

/**
 * Checks if a client is present during the lunch window (11:00-12:30).
 * This considers both AM end time and PM start time.
 * 
 * @param client - The client object
 * @param dayKey - The day key ('mon', 'tue', 'wed', 'thu', 'fri')
 * @returns true if the client is present during any part of lunch
 */
export function clientPresentDuringLunch(client: Client, dayKey: string): boolean {
  const times = getClientSessionTimes(client, dayKey);
  
  if (!times.enabled) return false;
  
  // Check if AM session extends into lunch (ends at or after 11:00)
  const amExtends = times.amEnd !== null && times.amEnd >= TIME_CONSTANTS.LUNCH_FIRST_SLOT;
  
  // Check if PM session starts during or before lunch end (starts at or before 12:30)
  const pmOverlaps = times.pmStart !== null && times.pmStart <= TIME_CONSTANTS.LUNCH_FOURTH_SLOT;
  
  return amExtends || pmOverlaps;
}

/**
 * LocalTemplateAssignment type for location checking without circular imports
 * Note: timeBlock is not needed since AM/PM assignments are already in separate arrays
 */
interface LocalAssignment {
  clientId: string | null;
  staffId: string;
  locationId?: string | null;
  startMinute?: number | null; // Precise start time in minutes from midnight
}

/**
 * Client location record for resolving location names
 */
interface LocalClientLocation {
  id: string;
  locationType: string;
}

/**
 * Resolves the effective location for a template assignment.
 * Priority: assignment.locationId -> clientLocation lookup -> client.defaultLocation
 * 
 * @param assignment - Template assignment with optional locationId
 * @param client - Client object with defaultLocation
 * @param clientLocations - Array of client location records to look up locationId
 * @returns The resolved location string (e.g., "school", "clinic", "home")
 */
function resolveAssignmentLocation(
  assignment: LocalAssignment | undefined,
  client: Client | undefined,
  clientLocations?: LocalClientLocation[]
): string {
  if (!assignment || !client) return "clinic";
  
  // If assignment has a locationId, look up the location type
  if (assignment.locationId && clientLocations) {
    const location = clientLocations.find(l => l.id === assignment.locationId);
    if (location) {
      return location.locationType || "clinic";
    }
  }
  
  // Fall back to client's default location
  return (client.defaultLocation as string) || "clinic";
}

/**
 * Checks if a client has a split-location assignment (different locations for AM vs PM).
 * Split-location clients transition between locations (e.g., school in AM → clinic in PM)
 * and are traveling during the lunch period, so they don't need lunch coverage.
 * 
 * This function resolves effective locations by:
 * 1. Using assignment.locationId to look up location type from clientLocations
 * 2. Falling back to client.defaultLocation if no locationId
 * 3. Comparing resolved AM vs PM locations
 * 
 * @param clientId - The client ID to check
 * @param amAssignments - AM template assignments
 * @param pmAssignments - PM template assignments
 * @param client - Optional client object for default location fallback
 * @param clientLocations - Optional array of client location records
 * @returns true if the client has different locations for AM and PM
 */
export function isSplitLocationClient(
  clientId: string,
  amAssignments: LocalAssignment[],
  pmAssignments: LocalAssignment[],
  client?: Client,
  clientLocations?: LocalClientLocation[]
): boolean {
  const amAssignment = amAssignments.find(a => a.clientId === clientId);
  const pmAssignment = pmAssignments.find(a => a.clientId === clientId);
  
  // If no assignments in both blocks, not split
  if (!amAssignment || !pmAssignment) return false;
  
  // Resolve effective locations for both assignments
  const amLocation = resolveAssignmentLocation(amAssignment, client, clientLocations);
  const pmLocation = resolveAssignmentLocation(pmAssignment, client, clientLocations);
  
  // Compare resolved locations - different locations means split
  return amLocation !== pmLocation;
}

/**
 * Checks if a client needs lunch coverage, considering split-location assignments.
 * Split-location clients (e.g., school in AM → clinic in PM) are traveling during lunch
 * and don't need coverage at either location.
 * 
 * @param client - The client object
 * @param dayKey - The day key ('mon', 'tue', 'wed', 'thu', 'fri')
 * @param amAssignments - AM template assignments for checking location splits
 * @param pmAssignments - PM template assignments for checking location splits
 * @param clientLocations - Optional array of client location records for location lookup
 * @returns true if the client needs lunch coverage, false if traveling or not present
 */
export function clientNeedsLunchCoverageWithLocationCheck(
  client: Client,
  dayKey: string,
  amAssignments: LocalAssignment[],
  pmAssignments: LocalAssignment[],
  clientLocations?: LocalClientLocation[]
): boolean {
  // First check basic time requirements
  if (!clientNeedsLunchCoverage(client, dayKey)) {
    return false;
  }
  
  // If client has split locations (traveling between AM and PM), no coverage needed
  if (isSplitLocationClient(client.id, amAssignments, pmAssignments, client, clientLocations)) {
    return false;
  }
  
  return true;
}

/**
 * Midday presence status for split-location clients.
 * Determines if a client has transitioned to their PM location by the 12:00-12:30 window.
 */
export interface SplitClientMiddayStatus {
  isSplitLocation: boolean;
  presentAt1200: boolean;         // Client is at PM location at 12:00
  pmStartMinute: number | null;   // When PM session starts (in minutes from midnight)
  pmStaffId: string | null;       // PM-assigned staff
  pmLocationId: string | null;    // PM location ID for display
}

/**
 * Gets the midday presence status for a split-location client.
 * 
 * For clients who transition between locations (e.g., school AM → clinic PM):
 * - If PM session starts at or before 12:00 (720 minutes), client is present at PM location
 * - If PM session starts after 12:00, client is still traveling during 12:00-12:30
 * 
 * @param clientId - Client ID to check
 * @param amAssignments - AM template assignments
 * @param pmAssignments - PM template assignments
 * @param client - Client object with session times
 * @param clientLocations - Optional client locations for location type resolution
 * @returns SplitClientMiddayStatus with presence and location info
 */
export function getSplitClientMiddayStatus(
  clientId: string,
  amAssignments: LocalAssignment[],
  pmAssignments: LocalAssignment[],
  client?: Client,
  clientLocations?: LocalClientLocation[]
): SplitClientMiddayStatus {
  const defaultStatus: SplitClientMiddayStatus = {
    isSplitLocation: false,
    presentAt1200: false,
    pmStartMinute: null,
    pmStaffId: null,
    pmLocationId: null
  };
  
  if (!client) return defaultStatus;
  
  // Check if this is actually a split-location client
  const isSplit = isSplitLocationClient(clientId, amAssignments, pmAssignments, client, clientLocations);
  if (!isSplit) return defaultStatus;
  
  const pmAssignment = pmAssignments.find(a => a.clientId === clientId);
  if (!pmAssignment) return { ...defaultStatus, isSplitLocation: true };
  
  // Get PM session start time from the template assignment
  // startMinute is stored in minutes from midnight (e.g., 720 = 12:00 PM)
  let pmStartMinute: number | null = null;
  if (pmAssignment.startMinute !== undefined && pmAssignment.startMinute !== null) {
    pmStartMinute = pmAssignment.startMinute;
  }
  
  // Default PM start is 12:30 (750 minutes) if not specified
  if (pmStartMinute === null) {
    pmStartMinute = 750;
  }
  
  // Client is present at PM location at 12:00 if their PM session starts at or before 12:00
  const presentAt1200 = pmStartMinute <= 720;
  
  return {
    isSplitLocation: true,
    presentAt1200,
    pmStartMinute,
    pmStaffId: pmAssignment.staffId,
    pmLocationId: pmAssignment.locationId || null
  };
}
