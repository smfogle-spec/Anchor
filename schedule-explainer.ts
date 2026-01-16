import type { StaffSchedule, ScheduleSlot, SourceTag } from "./schedule-data";
import type { Staff, Client, TemplateAssignment } from "@shared/schema";
import type { Exception, ApprovalRequest } from "./daily-run-data";
import type { LunchCoverageError, TrainingSessionUpdate } from "./schedule-engine";

export interface SubstitutionEntry {
  clientId: string;
  clientName: string;
  block: "AM" | "PM";
  originalStaffId: string | null;
  originalStaffName: string | null;
  originalStaffOutReason: string;
  substituteStaffId: string;
  substituteStaffName: string;
  substituteType: string;
  approvalStatus: "approved" | "pending" | "denied";
}

export interface AllDayStaffingEntry {
  staffId: string;
  staffName: string;
  clientId: string;
  clientName: string;
  approvalStatus: "approved" | "pending";
  reason: string;
}

export interface CancellationEntry {
  clientId: string;
  clientName: string;
  cancelType: "full_day" | "am_only" | "pm_only";
  reason: string;
  protectionStatus?: string;
  skipRuleApplied?: boolean;
  lastCanceledDate?: string;
  linkedSiblings?: string[];
}

export interface TrainingCancellationEntry {
  sessionId: string;
  traineeId: string;
  traineeName: string;
  clientId: string;
  clientName: string;
  originalDate: string;
  reason: string;
  newStatus: string;
}

export interface PendingApprovalEntry {
  id: string;
  type: string;
  typeLabel: string;
  clientName: string;
  staffName: string;
  block: string;
  reason: string;
  proposedAction: string;
}

export interface MajorChangeEntry {
  type: "assignment" | "location" | "time";
  clientId: string;
  clientName: string;
  block: string;
  before: string;
  after: string;
  reason: string;
}

export interface SlotExplanation {
  slotId: string;
  staffId: string;
  staffName: string;
  block: string;
  clientName: string;
  assignmentChain: string[];
  decisionReason: string;
  alternativesConsidered: string[];
  source: SourceTag;
}

export interface ScheduleExplainerReport {
  generatedAt: string;
  date: string;
  summary: {
    totalSlots: number;
    filledSlots: number;
    unfilledSlots: number;
    substitutionCount: number;
    cancellationCount: number;
    pendingApprovalCount: number;
  };
  substitutions: SubstitutionEntry[];
  allDayStaffing: AllDayStaffingEntry[];
  cancellations: CancellationEntry[];
  trainingCancellations: TrainingCancellationEntry[];
  pendingApprovals: PendingApprovalEntry[];
  majorChanges: MajorChangeEntry[];
  lunchCoverageIssues: LunchCoverageError[];
  slotExplanations: SlotExplanation[];
}

interface EnrichedTrainingSession {
  id: string;
  planId: string;
  traineeId: string | null;
  clientId: string | null;
  preferredTrainerId: string | null;
  scheduledDate: string | null;
  stageType: string;
}

interface ExplainerData {
  schedule: StaffSchedule[];
  staffList: Staff[];
  clientList: Client[];
  templateAssignments: TemplateAssignment[];
  exceptions: Exception[];
  pendingApprovals: ApprovalRequest[];
  lunchCoverageErrors: LunchCoverageError[];
  trainingSessionUpdates: TrainingSessionUpdate[];
  trainingSessions?: EnrichedTrainingSession[];
}

function getDayOfWeekKey(date: Date): string {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[date.getDay()];
}

export function generateScheduleExplainerReport(data: ExplainerData): ScheduleExplainerReport {
  const { schedule, staffList, clientList, templateAssignments, exceptions, pendingApprovals, lunchCoverageErrors, trainingSessionUpdates, trainingSessions = [] } = data;
  
  const staffMap = new Map(staffList.map(s => [s.id, s]));
  const clientMap = new Map(clientList.map(c => [c.id, c]));
  
  const today = new Date();
  const dayKey = getDayOfWeekKey(today);
  const todayTemplates = templateAssignments.filter(t => t.weekDay === dayKey);
  
  const substitutions: SubstitutionEntry[] = [];
  const allDayStaffing: AllDayStaffingEntry[] = [];
  const cancellations: CancellationEntry[] = [];
  const majorChanges: MajorChangeEntry[] = [];
  const slotExplanations: SlotExplanation[] = [];
  
  let totalSlots = 0;
  let filledSlots = 0;
  let unfilledSlots = 0;

  const staffOutExceptions = exceptions.filter(e => e.type === "staff" && e.mode === "out");
  const clientCancelExceptions = exceptions.filter(e => e.type === "client" && (e.mode === "cancelled" || e.mode === "out"));
  
  schedule.forEach(staffSched => {
    const staff = staffMap.get(staffSched.staffId);
    const staffName = staff?.name || staffSched.staffId;
    
    staffSched.slots.forEach((slot, idx) => {
      if (slot.block === "LUNCH" || slot.value === "LUNCH") return;
      
      totalSlots++;
      
      if (slot.source === "UNFILLED" || slot.value === "OPEN") {
        unfilledSlots++;
      } else if (slot.source !== "CANCEL") {
        filledSlots++;
      }
      
      const client = slot.clientId ? clientMap.get(slot.clientId) : null;
      const clientName = client?.name || slot.value || "Unknown";
      
      const assignmentChain: string[] = [];
      const alternativesConsidered: string[] = [];
      let decisionReason = "";
      
      const slotBlock = (slot.startMinute && slot.startMinute < 720) ? "AM" : "PM";
      const templateMatch = todayTemplates.find(t => 
        t.staffId === staffSched.staffId && 
        t.clientId === slot.clientId && 
        t.timeBlock === slotBlock
      );
      
      if (templateMatch) {
        assignmentChain.push("Template assignment");
        decisionReason = `${staffName} is the template-assigned staff for ${clientName}`;
      }
      
      const isSub = slot.indicator === "Sub" || 
        slot.source === "REPAIR" || 
        slot.reason?.toLowerCase().includes("sub") ||
        slot.reason?.toLowerCase().includes("substitute");
      if (isSub && slot.clientId) {
        const originalTemplate = slot.clientId ? todayTemplates.find(t => t.clientId === slot.clientId && t.timeBlock === slotBlock) : null;
        const originalStaff = originalTemplate ? staffMap.get(originalTemplate.staffId) : null;
        const outException = originalTemplate ? staffOutExceptions.find(e => e.entityId === originalTemplate.staffId) : null;
        
        assignmentChain.push("Template staff unavailable");
        assignmentChain.push("Sub search initiated");
        assignmentChain.push(`${staffName} assigned as substitute`);
        
        decisionReason = `Original staff ${originalStaff?.name || 'unknown'} was out. ${staffName} was selected as substitute.`;
        
        if (originalStaff && slot.clientId) {
          substitutions.push({
            clientId: slot.clientId,
            clientName,
            block: (slot.startMinute && slot.startMinute < 720) ? "AM" : "PM",
            originalStaffId: originalTemplate?.staffId || null,
            originalStaffName: originalStaff?.name || null,
            originalStaffOutReason: outException?.allDay ? "Out all day" : outException?.timeWindow ? `Out until ${outException.timeWindow.end}` : "Out",
            substituteStaffId: staffSched.staffId,
            substituteStaffName: staffName,
            substituteType: staff?.role || "Unknown",
            approvalStatus: "approved"
          });
        }
      }
      
      const isFloat = slot.indicator === "Float" || staff?.role === "Float";
      if (isFloat && !templateMatch) {
        assignmentChain.push("No trained staff available");
        assignmentChain.push("Float search initiated");
        assignmentChain.push(`${staffName} (Float) assigned`);
        decisionReason = `No trained or focus staff were available. ${staffName} was assigned as a float.`;
      }
      
      const isLead = slot.indicator === "Lead" || staff?.role === "Lead RBT";
      if (isLead && !templateMatch) {
        assignmentChain.push("All regular staff exhausted");
        assignmentChain.push("Lead RBT used as last resort");
        assignmentChain.push(`${staffName} (Lead RBT) assigned`);
        decisionReason = `All trained staff and floats were unavailable. ${staffName} was assigned as Lead RBT to prevent cancellation.`;
      }
      
      if (slot.source === "CANCEL") {
        assignmentChain.push("All staffing options exhausted");
        assignmentChain.push("Cancellation decision triggered");
        decisionReason = slot.reason || "No available staff for this slot";
      }
      
      if (slot.source === "UNFILLED") {
        assignmentChain.push("Gap detected");
        assignmentChain.push("Awaiting approval or staff assignment");
        decisionReason = slot.reason || "Waiting for substitute approval";
        alternativesConsidered.push("Checked trained staff: none available");
        alternativesConsidered.push("Checked float staff: none available or pending approval");
      }
      
      if (assignmentChain.length === 0) {
        assignmentChain.push("Direct assignment");
        decisionReason = `${staffName} was directly assigned`;
      }
      
      slotExplanations.push({
        slotId: slot.id,
        staffId: staffSched.staffId,
        staffName,
        block: slot.block,
        clientName,
        assignmentChain,
        decisionReason,
        alternativesConsidered,
        source: slot.source
      });
    });
  });

  clientCancelExceptions.forEach(exc => {
    const client = clientMap.get(exc.entityId);
    if (!client) return;
    
    cancellations.push({
      clientId: exc.entityId,
      clientName: client.name,
      cancelType: exc.allDay ? "full_day" : "am_only",
      reason: exc.mode === "cancelled" ? "Client cancelled for the day" : "Client marked as out",
      protectionStatus: undefined,
      skipRuleApplied: false
    });
  });

  const cancellationApprovals = pendingApprovals.filter(a => 
    a.type === "cancellation" || a.type === "cancel_protected" || a.type === "cancel_skipped"
  );
  
  cancellationApprovals.forEach(approval => {
    if (!approval.clientId) return;
    const client = clientMap.get(approval.clientId);
    if (!client) return;
    
    const existing = cancellations.find(c => c.clientId === approval.clientId);
    if (existing) return;
    
    let protectionStatus: string | undefined;
    let skipRuleApplied = false;
    
    if (approval.type === "cancel_protected") {
      protectionStatus = "30-day new client protection";
    }
    if (approval.type === "cancel_skipped") {
      skipRuleApplied = true;
    }
    
    cancellations.push({
      clientId: approval.clientId,
      clientName: client.name,
      cancelType: approval.block === "AM" ? "am_only" : approval.block === "PM" ? "pm_only" : "full_day",
      reason: approval.reason || "Engine-determined cancellation",
      protectionStatus,
      skipRuleApplied
    });
  });

  const sessionMap = new Map(trainingSessions.map(s => [s.id, s]));
  
  const trainingCancellations: TrainingCancellationEntry[] = trainingSessionUpdates.map(update => {
    const session = sessionMap.get(update.sessionId);
    const trainee = session?.traineeId ? staffMap.get(session.traineeId) : null;
    const client = session?.clientId ? clientMap.get(session.clientId) : null;
    
    return {
      sessionId: `#${update.sessionId.substring(0, 8)}`,
      traineeId: session?.traineeId || "",
      traineeName: trainee?.name || (update.reason.includes("Trainee") ? "Trainee unavailable" : "Unknown"),
      clientId: session?.clientId || "",
      clientName: client?.name || (update.reason.includes("client") ? "Training client" : "Unknown"),
      originalDate: session?.scheduledDate || today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      reason: update.reason,
      newStatus: update.newStatus
    };
  });

  const pendingApprovalEntries: PendingApprovalEntry[] = pendingApprovals
    .filter(a => a.status === "pending")
    .map(approval => {
      let typeLabel = "";
      let reason = "";
      let proposedAction = "";
      
      switch (approval.type) {
        case "sub_staffing":
          typeLabel = "Substitute Staffing";
          reason = `Original staff unavailable for ${approval.clientName || "client"}`;
          proposedAction = `Assign ${approval.proposedSubName || "substitute"} as sub`;
          break;
        case "lead_staffing":
          typeLabel = "Lead RBT Assignment";
          reason = "All regular staff exhausted";
          proposedAction = `Assign ${approval.proposedSubName || "Lead RBT"} to prevent cancellation`;
          break;
        case "lead_reserve":
          typeLabel = "Lead Reserve Warning";
          reason = "Low lead availability (fewer than 4 remaining)";
          proposedAction = `Assign ${approval.proposedSubName || "Lead RBT"} from reserves`;
          break;
        case "all_day_staffing":
          typeLabel = "All-Day Staffing";
          reason = `Same staff assigned to ${approval.clientName || "client"} for both AM and PM`;
          proposedAction = "Confirm all-day assignment";
          break;
        default:
          typeLabel = approval.type;
          reason = approval.reason || "";
          proposedAction = "";
      }
      
      return {
        id: approval.id,
        type: approval.type,
        typeLabel,
        clientName: approval.clientName || "Unknown",
        staffName: approval.proposedSubName || "Unknown",
        block: approval.block || "All Day",
        reason,
        proposedAction
      };
    });

  const allDayApprovals = pendingApprovals.filter(a => a.type === "all_day_staffing");
  allDayApprovals.forEach(approval => {
    if (!approval.clientId || !approval.proposedSubId) return;
    const client = clientMap.get(approval.clientId);
    const staff = staffMap.get(approval.proposedSubId);
    
    allDayStaffing.push({
      staffId: approval.proposedSubId,
      staffName: staff?.name || approval.proposedSubName || "Unknown",
      clientId: approval.clientId,
      clientName: client?.name || approval.clientName || "Unknown",
      approvalStatus: approval.status === "approved" ? "approved" : "pending",
      reason: "Template assigns same staff for both AM and PM blocks"
    });
  });

  const allDayFromSchedule = new Map<string, { staffId: string; clientId: string; amSlot: boolean; pmSlot: boolean }>();
  schedule.forEach(staffSched => {
    staffSched.slots.forEach(slot => {
      if (!slot.clientId || slot.block === "LUNCH" || slot.value === "LUNCH") return;
      
      let isAM = false;
      let isPM = false;
      
      if (slot.startMinute !== undefined) {
        isAM = slot.startMinute < 720;
        isPM = slot.startMinute >= 720;
      } else if (slot.block) {
        isAM = slot.block === "AM" || slot.block.includes("AM");
        isPM = slot.block === "PM" || slot.block.includes("PM");
      }
      
      if (!isAM && !isPM) return;
      
      const key = `${staffSched.staffId}-${slot.clientId}`;
      
      const existing = allDayFromSchedule.get(key) || { 
        staffId: staffSched.staffId, 
        clientId: slot.clientId, 
        amSlot: false, 
        pmSlot: false 
      };
      
      if (isAM) existing.amSlot = true;
      if (isPM) existing.pmSlot = true;
      allDayFromSchedule.set(key, existing);
    });
  });

  allDayFromSchedule.forEach((entry) => {
    if (entry.amSlot && entry.pmSlot) {
      const alreadyTracked = allDayStaffing.some(
        a => a.staffId === entry.staffId && a.clientId === entry.clientId
      );
      if (!alreadyTracked) {
        const staff = staffMap.get(entry.staffId);
        const client = clientMap.get(entry.clientId);
        allDayStaffing.push({
          staffId: entry.staffId,
          staffName: staff?.name || "Unknown",
          clientId: entry.clientId,
          clientName: client?.name || "Unknown",
          approvalStatus: "approved",
          reason: "Staff assigned to same client for both AM and PM"
        });
      }
    }
  });

  todayTemplates.forEach(template => {
    if (!template.clientId) return;
    
    const matchingSlot = schedule.flatMap(s => s.slots).find(slot => 
      slot.clientId === template.clientId && 
      ((template.timeBlock === "AM" && slot.startMinute && slot.startMinute < 720) ||
       (template.timeBlock === "PM" && slot.startMinute && slot.startMinute >= 720))
    );
    
    if (!matchingSlot) return;
    
    const currentStaff = schedule.find(s => s.slots.includes(matchingSlot));
    if (!currentStaff || currentStaff.staffId === template.staffId) return;
    
    if (matchingSlot.source === "TEMPLATE") return;
    
    const templateStaff = staffMap.get(template.staffId);
    const actualStaff = staffMap.get(currentStaff.staffId);
    const client = clientMap.get(template.clientId);
    
    const alreadyTracked = substitutions.some(s => 
      s.clientId === template.clientId && s.block === template.timeBlock
    );
    
    if (!alreadyTracked && templateStaff && actualStaff) {
      majorChanges.push({
        type: "assignment",
        clientId: template.clientId,
        clientName: client?.name || "Unknown",
        block: template.timeBlock,
        before: templateStaff.name,
        after: actualStaff.name,
        reason: matchingSlot.reason || "Staff change from template"
      });
    }
  });

  return {
    generatedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    date: today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    summary: {
      totalSlots,
      filledSlots,
      unfilledSlots,
      substitutionCount: substitutions.length,
      cancellationCount: cancellations.length,
      pendingApprovalCount: pendingApprovalEntries.length
    },
    substitutions,
    allDayStaffing,
    cancellations,
    trainingCancellations,
    pendingApprovals: pendingApprovalEntries,
    majorChanges,
    lunchCoverageIssues: lunchCoverageErrors,
    slotExplanations
  };
}
