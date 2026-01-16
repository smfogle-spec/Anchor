import type {
  Client,
  Staff,
  ApprovalRequest,
  ApprovedSub,
} from "./types";

export interface ApprovalCheckResult {
  needsApproval: boolean;
  approvalType?: 'sub' | 'lead_staffing' | 'lead_reserve' | 'all_day_staffing';
  reason?: string;
}

export function checkSubApproval(
  client: Client,
  originalStaffId: string,
  proposedSubId: string,
  allStaff: Staff[]
): ApprovalCheckResult {
  const proposedSub = allStaff.find(s => s.id === proposedSubId);
  if (!proposedSub) {
    return { needsApproval: false };
  }

  if (!client.allowSub) {
    return { 
      needsApproval: true, 
      approvalType: 'sub',
      reason: `Client does not allow substitutes` 
    };
  }

  return { needsApproval: false };
}

export function checkLeadApproval(
  client: Client,
  proposedLeadId: string,
  allStaff: Staff[],
  availableLeadsCount: number
): ApprovalCheckResult {
  const lead = allStaff.find(s => s.id === proposedLeadId);
  if (!lead || lead.role !== 'Lead RBT') {
    return { needsApproval: false };
  }

  if (availableLeadsCount <= 4) {
    return {
      needsApproval: true,
      approvalType: 'lead_reserve',
      reason: `Using lead would leave only ${availableLeadsCount - 1} leads available (below reserve threshold of 4)`
    };
  }

  return {
    needsApproval: true,
    approvalType: 'lead_staffing',
    reason: `Lead RBT assignment requires approval`
  };
}

export function checkAllDayStaffingApproval(
  staffId: string,
  clientId: string,
  amClientId: string | null | undefined,
  pmClientId: string | null | undefined
): ApprovalCheckResult {
  if (amClientId && pmClientId && amClientId === pmClientId && amClientId === clientId) {
    return {
      needsApproval: true,
      approvalType: 'all_day_staffing',
      reason: `Same staff assigned to same client for both AM and PM`
    };
  }

  return { needsApproval: false };
}

export function isSubApproved(
  clientId: string,
  block: "AM" | "PM",
  subStaffId: string,
  approvedSubs: ApprovedSub[]
): boolean {
  return approvedSubs.some(
    sub => sub.clientId === clientId && sub.block === block && sub.subStaffId === subStaffId
  );
}

export function createSubApprovalRequest(
  clientId: string,
  clientName: string,
  staffId: string,
  staffName: string,
  block: "AM" | "PM",
  reason: string
): ApprovalRequest {
  return {
    id: `sub-${clientId}-${block}-${staffId}`,
    type: 'sub',
    clientId,
    clientName,
    staffId,
    staffName,
    block,
    status: 'pending',
    reason,
    createdAt: new Date().toISOString()
  };
}

export function createLeadApprovalRequest(
  clientId: string,
  clientName: string,
  leadId: string,
  leadName: string,
  block: "AM" | "PM",
  isReserve: boolean,
  reason: string
): ApprovalRequest {
  return {
    id: `lead-${clientId}-${block}-${leadId}`,
    type: isReserve ? 'lead_reserve' : 'lead_staffing',
    clientId,
    clientName,
    staffId: leadId,
    staffName: leadName,
    block,
    status: 'pending',
    reason,
    createdAt: new Date().toISOString()
  };
}

export function createAllDayApprovalRequest(
  clientId: string,
  clientName: string,
  staffId: string,
  staffName: string
): ApprovalRequest {
  return {
    id: `all-day-${clientId}-${staffId}`,
    type: 'all_day_staffing',
    clientId,
    clientName,
    staffId,
    staffName,
    block: 'AM',
    status: 'pending',
    reason: `All-day staffing: ${staffName} assigned to ${clientName} for both AM and PM`,
    createdAt: new Date().toISOString()
  };
}
