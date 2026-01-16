import type {
  Client,
  ClientLocation,
  ClientCancelLink,
  CancelTiming,
  UncoveredGap,
  CancelCandidate,
  CancelDecision,
  SchedulerTrainingSession,
  TemplateAssignment,
} from "./types";
import { parseLocalDate } from "./utils";

export function determineCancelTiming(canBeGrouped: boolean, block: "AM" | "PM" | "ALL_DAY"): CancelTiming {
  if (block === "ALL_DAY") return "all_day";
  
  if (!canBeGrouped) {
    return block === "PM" ? "at_1130" : "until_1230";
  } else {
    return block === "AM" ? "until_1130" : "at_1230";
  }
}

export function getCancelTimingDescription(timing: CancelTiming): string {
  switch (timing) {
    case "all_day": return "Cancelled all day";
    case "until_1130": return "Cancelled until 11:30 AM";
    case "until_1230": return "Cancelled until 12:30 PM";
    case "at_1130": return "Cancelled at 11:30 AM";
    case "at_1230": return "Cancelled at 12:30 PM";
    default: return "Cancelled";
  }
}

export function buildCancelPool(
  gaps: UncoveredGap[],
  allClients: Client[],
  clientLocations: ClientLocation[],
  cancelLinks: ClientCancelLink[],
  templateAssignments: TemplateAssignment[],
  trainingSessions: SchedulerTrainingSession[] = [],
  isNewHireProtectedFn?: (staffId: string) => boolean
): CancelCandidate[] {
  const clientGaps = new Map<string, { client: Client; blocks: ("AM" | "PM")[] }>();
  
  for (const gap of gaps) {
    const client = allClients.find(c => c.id === gap.clientId);
    if (!client) continue;
    
    const existing = clientGaps.get(gap.clientId);
    if (existing) {
      if (!existing.blocks.includes(gap.block)) {
        existing.blocks.push(gap.block);
      }
    } else {
      clientGaps.set(gap.clientId, { client, blocks: [gap.block] });
    }
  }
  
  const candidates: CancelCandidate[] = [];
  const today = new Date();
  
  for (const [clientId, { client, blocks }] of Array.from(clientGaps.entries())) {
    const locations = clientLocations.filter(loc => loc.clientId === clientId);
    let isProtected = false;
    let protectionReason: string | undefined;
    
    for (const loc of locations) {
      if (loc.serviceStartDate) {
        const startDate = parseLocalDate(loc.serviceStartDate);
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceStart < 30) {
          isProtected = true;
          const exemptDate = new Date(startDate);
          exemptDate.setDate(exemptDate.getDate() + 30);
          protectionReason = `Not for cancel until ${exemptDate.toLocaleDateString()} due to ${loc.locationType} sessions less than 30 days old.`;
          break;
        }
      }
    }
    
    if (!isProtected && isNewHireProtectedFn) {
      const clientTrainingSessions = trainingSessions.filter(ts => 
        ts.clientId === clientId && 
        ts.status === 'planned' && 
        (ts.planStatus === 'active' || ts.planStatus === null) &&
        ts.trainingTrack === 'new_hire'
      );
      
      for (const session of clientTrainingSessions) {
        if (session.traineeId && isNewHireProtectedFn(session.traineeId)) {
          isProtected = true;
          protectionReason = `Protected for new hire training session. Cancelling would disrupt trainee onboarding.`;
          break;
        }
      }
    }
    
    const linkedClientIds = cancelLinks
      .filter(link => link.clientId === clientId || link.linkedClientId === clientId)
      .map(link => link.clientId === clientId ? link.linkedClientId : link.clientId);
    
    let isSkipped = false;
    let skipReason: string | undefined;
    
    // Calculate days per week from template assignments (not manual sessionsPerWeek)
    const clientAssignments = templateAssignments.filter(a => a.clientId === clientId);
    const scheduledDays = new Set(clientAssignments.map(a => a.weekDay));
    const daysPerWeek = scheduledDays.size;
    
    const cancelSkipUsed = client.cancelSkipUsed ?? false;
    // Skip eligible if client attends 2 days or fewer per week (calculated from template)
    if (daysPerWeek > 0 && daysPerWeek <= 2 && !cancelSkipUsed) {
      isSkipped = true;
      skipReason = `2-day/week skip applied (attends ${daysPerWeek} day${daysPerWeek === 1 ? '' : 's'})`;
    }
    
    const consecutiveAbsentDays = client.consecutiveAbsentDays ?? 0;
    const daysBackSinceAbsence = (client as any).daysBackSinceAbsence ?? 0;
    // Skip if 5+ days absent AND haven't returned for 3+ days yet
    if (consecutiveAbsentDays >= 5 && daysBackSinceAbsence < 3) {
      isSkipped = true;
      skipReason = `5-consecutive-days absent skip applied (${3 - daysBackSinceAbsence} more attendance day${3 - daysBackSinceAbsence === 1 ? '' : 's'} needed)`;
    }
    
    candidates.push({
      clientId,
      clientName: client.name,
      client,
      affectedBlocks: blocks,
      lastCanceledDate: client.lastCanceledDate || null,
      isProtected,
      protectionReason,
      skipReason,
      isSkipped,
      linkedClientIds,
      cancelAllDayOnly: client.cancelAllDayOnly ?? false,
      canBeGrouped: client.canBeGrouped ?? false,
      sessionsPerWeek: daysPerWeek, // Calculated from template
      cancelSkipUsed,
      consecutiveAbsentDays
    });
  }
  
  return candidates;
}

export function selectCancelTarget(
  candidates: CancelCandidate[],
  preferFullDay: boolean = true
): CancelDecision | null {
  const skippedClients: { clientId: string; clientName: string; skipReason: string }[] = [];
  const eligibleCandidates = candidates.filter(c => {
    if (c.isProtected) return false;
    if (c.isSkipped) {
      skippedClients.push({ clientId: c.clientId, clientName: c.clientName, skipReason: c.skipReason! });
      return false;
    }
    return true;
  });
  
  if (eligibleCandidates.length === 0) {
    return null;
  }
  
  eligibleCandidates.sort((a, b) => {
    if (!a.lastCanceledDate && !b.lastCanceledDate) return 0;
    if (!a.lastCanceledDate) return -1;
    if (!b.lastCanceledDate) return 1;
    return parseLocalDate(a.lastCanceledDate).getTime() - parseLocalDate(b.lastCanceledDate).getTime();
  });
  
  if (preferFullDay) {
    const fullDayCandidate = eligibleCandidates.find(c => 
      c.affectedBlocks.includes("AM") && c.affectedBlocks.includes("PM")
    ) || eligibleCandidates.find(c => c.cancelAllDayOnly);
    
    if (fullDayCandidate) {
      const timing = determineCancelTiming(fullDayCandidate.canBeGrouped, "ALL_DAY");
      return {
        targetClientId: fullDayCandidate.clientId,
        targetClientName: fullDayCandidate.clientName,
        timing,
        linkedClientIds: fullDayCandidate.linkedClientIds,
        block: "ALL_DAY",
        reason: `${fullDayCandidate.clientName} selected for cancellation (last cancelled: ${fullDayCandidate.lastCanceledDate || 'Never'})`,
        skippedClients
      };
    }
  }
  
  const target = eligibleCandidates[0];
  
  const block: "AM" | "PM" | "ALL_DAY" = target.cancelAllDayOnly 
    ? "ALL_DAY" 
    : (target.affectedBlocks.length === 2 ? "ALL_DAY" : target.affectedBlocks[0]);
  
  const timing = determineCancelTiming(target.canBeGrouped, block);
  
  return {
    targetClientId: target.clientId,
    targetClientName: target.clientName,
    timing,
    linkedClientIds: target.linkedClientIds,
    block,
    reason: `${target.clientName} selected for cancellation (last cancelled: ${target.lastCanceledDate || 'Never'})`,
    skippedClients
  };
}
