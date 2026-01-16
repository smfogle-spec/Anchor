export type ExceptionType = "client" | "staff";
export type ExceptionMode = "in" | "out" | "cancelled" | "location";
export type LocationType = "clinic" | "home" | "community" | "other";

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface Exception {
  id: string;
  type: ExceptionType;
  entityId: string; // clientId or staffId
  mode: ExceptionMode;
  allDay: boolean;
  timeWindow?: TimeWindow;
  locationOverride?: LocationType; // Only for mode: "location"
}

export type ApprovalStatus = "pending" | "approved" | "denied" | "blocked";
export type ApprovalType = "sub_staffing" | "lead_staffing" | "lead_reserve" | "all_day_staffing" | "lunch_group_size" | "cancellation" | "cancel_protected" | "cancel_skipped" | "other";

// Cancel timing types based on spec
export type CancelTiming = "all_day" | "until_1130" | "until_1230" | "at_1130" | "at_1230";

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  description: string;
  reason: string;
  status: ApprovalStatus;
  clientId?: string;
  clientName?: string;
  block?: "AM" | "PM";
  originalStaffId?: string;
  originalStaffName?: string;
  proposedSubId?: string;
  proposedSubName?: string;
  // Cancellation-specific fields
  cancelTiming?: CancelTiming;
  linkedClientIds?: string[];  // For sibling cancellations
  skipReason?: string;  // Why client was skipped (2-day/week skip, 5-day-absent skip)
}

export interface ManualOverride {
  id: string;
  staffId: string;
  block: "AM" | "PM";
  value: string; // Free text
}

// Mock initial data for today
export const MOCK_EXCEPTIONS: Exception[] = [
  {
    id: "e1",
    type: "client",
    entityId: "c2", // Bella R.
    mode: "out",
    allDay: true
  }
];

export const MOCK_APPROVALS: ApprovalRequest[] = [];

export const MOCK_OVERRIDES: ManualOverride[] = [];
