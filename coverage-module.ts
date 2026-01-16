import type {
  Staff,
  Client,
  TemplateAssignment,
  WeeklyTemplate,
  WeekDay,
  LocalTemplateAssignment,
  UncoveredGap,
} from "./types";

export function buildTemplateFromAssignments(assignments: TemplateAssignment[]): WeeklyTemplate {
  const template: WeeklyTemplate = {
    mon: { am: [], pm: [] },
    tue: { am: [], pm: [] },
    wed: { am: [], pm: [] },
    thu: { am: [], pm: [] },
    fri: { am: [], pm: [] },
  };
  
  // Group assignments by (day, block, staffId) to detect multi-segment assignments
  const groupedAssignments = new Map<string, TemplateAssignment[]>();
  
  assignments.forEach(a => {
    const key = `${a.weekDay}-${a.timeBlock.toLowerCase()}-${a.staffId}`;
    if (!groupedAssignments.has(key)) {
      groupedAssignments.set(key, []);
    }
    groupedAssignments.get(key)!.push(a);
  });
  
  // Process each group
  groupedAssignments.forEach((group, key) => {
    const [day, block] = key.split('-') as [WeekDay, "am" | "pm"];
    
    if (!template[day] || !template[day][block]) return;
    
    if (group.length === 1) {
      // Single assignment - add as normal
      const a = group[0];
      const entry: LocalTemplateAssignment = {
        staffId: a.staffId,
        clientId: a.clientId
      };
      if (a.locationId) {
        entry.locationId = a.locationId;
      }
      if (a.startMinute !== undefined && a.startMinute !== null) {
        entry.startMinute = a.startMinute;
      }
      if (a.endMinute !== undefined && a.endMinute !== null) {
        entry.endMinute = a.endMinute;
      }
      template[day][block].push(entry);
    } else {
      // Multiple assignments for same staff/day/block - merge into segments
      // Sort by startMinute to ensure proper ordering
      const sortedGroup = [...group].sort((a, b) => {
        const aStart = a.startMinute ?? 0;
        const bStart = b.startMinute ?? 0;
        return aStart - bStart;
      });
      
      // Find the primary client assignment (non-null clientId, or the first one if all null)
      const clientAssignments = sortedGroup.filter(a => a.clientId !== null);
      const primaryAssignment = clientAssignments.length > 0 
        ? clientAssignments[0] // Use FIRST client assignment (earliest in schedule)
        : sortedGroup[0];
      
      // Build segments array from ALL assignments (including null clientId for drive/gap/support)
      // Null clientId segments represent drive time or lead/bx support periods
      const allSegments = sortedGroup.map(a => ({
        clientId: a.clientId, // Keep null for drive/support segments
        locationId: a.locationId ?? null,
        startMinute: a.startMinute ?? (block === 'am' ? 450 : 750),
        endMinute: a.endMinute ?? (block === 'am' ? 690 : 960)
      }));
      
      // Create merged entry with primary client info and ALL segments
      const entry: LocalTemplateAssignment = {
        staffId: primaryAssignment.staffId,
        clientId: primaryAssignment.clientId,
        locationId: primaryAssignment.locationId ?? undefined,
        startMinute: allSegments[0].startMinute,
        endMinute: allSegments[allSegments.length - 1].endMinute,
        segments: allSegments
      };
      
      template[day][block].push(entry);
    }
  });
  
  return template;
}

export function getEligibleStaff(allStaff: Staff[]): Staff[] {
  return allStaff.filter(s => s.active !== false && s.role !== "BCBA");
}

export function getSortedStaff(eligibleStaff: Staff[]): Staff[] {
  return [...eligibleStaff].sort((a, b) => a.name.localeCompare(b.name));
}

export function isStaffExcludedFromClient(staffId: string, client: Client): boolean {
  const excludedStaffIds = (client.excludedStaffIds as string[]) || [];
  return excludedStaffIds.includes(staffId);
}

export function isStaffNoLongerTrained(staffId: string, client: Client): boolean {
  const noLongerTrainedIds = (client.noLongerTrainedIds as string[]) || [];
  return noLongerTrainedIds.includes(staffId);
}

export function isStaffFocusForClient(staffId: string, client: Client): boolean {
  const focusStaffIds = (client.focusStaffIds as string[]) || [];
  return focusStaffIds.includes(staffId);
}

export function isStaffTrainedForClient(staffId: string, client: Client): boolean {
  const trainedStaffIds = (client.trainedStaffIds as string[]) || [];
  return trainedStaffIds.includes(staffId);
}

export function getClientStaffPriority(
  staffId: string,
  client: Client,
  staffMember: Staff
): 'focus' | 'trained' | 'float' | 'lead' | 'none' {
  if (isStaffExcludedFromClient(staffId, client)) return 'none';
  if (isStaffNoLongerTrained(staffId, client)) return 'none';
  
  if (isStaffFocusForClient(staffId, client)) return 'focus';
  if (isStaffTrainedForClient(staffId, client)) return 'trained';
  
  const allowedFloatRbtIds = (client.allowedFloatRbtIds as string[]) || [];
  if (staffMember.role === 'Float' && client.floatRbtsAllowed && allowedFloatRbtIds.includes(staffId)) {
    return 'float';
  }
  
  const allowedLeadRbtIds = (client.allowedLeadRbtIds as string[]) || [];
  if (staffMember.role === 'Lead RBT' && client.leadRbtsAllowed && allowedLeadRbtIds.includes(staffId)) {
    return 'lead';
  }
  
  return 'none';
}

export function findAvailableStaffForClient(
  client: Client,
  allStaff: Staff[],
  outStaffIds: Set<string>,
  alreadyAssignedStaffIds: Set<string>
): { staffId: string; priority: 'focus' | 'trained' | 'float' | 'lead' }[] {
  const available: { staffId: string; priority: 'focus' | 'trained' | 'float' | 'lead' }[] = [];
  
  for (const staffMember of allStaff) {
    if (!staffMember.active) continue;
    if (outStaffIds.has(staffMember.id)) continue;
    if (alreadyAssignedStaffIds.has(staffMember.id)) continue;
    
    const priority = getClientStaffPriority(staffMember.id, client, staffMember);
    if (priority !== 'none') {
      available.push({ staffId: staffMember.id, priority });
    }
  }
  
  return available.sort((a, b) => {
    const priorityOrder = { focus: 0, trained: 1, float: 2, lead: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function detectUncoveredGaps(
  dayAssignments: { am: LocalTemplateAssignment[]; pm: LocalTemplateAssignment[] },
  allClients: Client[],
  outStaffIds: Set<string>,
  unavailableClients: Set<string>
): UncoveredGap[] {
  const gaps: UncoveredGap[] = [];
  
  for (const block of ['am', 'pm'] as const) {
    const assignments = dayAssignments[block];
    
    for (const assignment of assignments) {
      if (!assignment.clientId) continue;
      if (unavailableClients.has(assignment.clientId)) continue;
      
      if (outStaffIds.has(assignment.staffId)) {
        const client = allClients.find(c => c.id === assignment.clientId);
        if (client) {
          gaps.push({
            clientId: assignment.clientId,
            clientName: client.name,
            block: block.toUpperCase() as "AM" | "PM",
            originalStaffId: assignment.staffId
          });
        }
      }
    }
  }
  
  return gaps;
}
