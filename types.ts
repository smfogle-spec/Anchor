import type { Staff, Client, TemplateAssignment, ClientLocation, School, ClientCancelLink } from "@shared/schema";
import type { Exception, ApprovalRequest, CancelTiming } from "../daily-run-data";
import type { StaffSchedule, SourceTag, ScheduleSegment } from "../schedule-data";
import type { WeeklyTemplate, WeekDay, TemplateAssignment as LocalTemplateAssignment } from "../template-data";

export type { Exception, ApprovalRequest, CancelTiming };
export type { StaffSchedule, SourceTag, ScheduleSegment };
export type { WeeklyTemplate, WeekDay, LocalTemplateAssignment };
export type { Staff, Client, TemplateAssignment, ClientLocation, School, ClientCancelLink };

export interface SchedulerTrainingSession {
  id: string;
  planId: string;
  stageOrder: number;
  stageType: 'shadow' | 'support' | 'sign_off' | 'shadow_support';
  scheduledDate: string | null;
  scheduledBlock: 'AM' | 'PM' | null;
  status: 'planned' | 'completed' | 'confirmed' | 'disrupted' | 'blocked' | 'skipped';
  trainerId: string | null;
  traineeId: string | null;
  clientId: string | null;
  preferredTrainerId: string | null;
  trainingTrack: 'caseload_change' | 'new_hire' | 'additional' | null;
  trainingStyle: 'half' | 'full' | 'double' | 'expedited' | null;
  planStatus: 'active' | 'completed' | 'paused' | null;
}

export interface TrainingSessionUpdate {
  sessionId: string;
  newStatus: 'disrupted' | 'blocked';
  reason: string;
}

export interface ScheduleEngineData {
  staff: Staff[];
  clients: Client[];
  templateAssignments: TemplateAssignment[];
  clientLocations?: ClientLocation[];
  schools?: School[];
  cancelLinks?: ClientCancelLink[];
  trainingSessions?: SchedulerTrainingSession[];
}

export interface ScheduleChangeEntry {
  id: string;
  date: string;
  timeBlock: string;
  staffId: string;
  staffName: string;
  clientId?: string;
  clientName?: string;
  changeType: "assignment" | "location" | "status" | "sub";
  source: string;
  beforeValue: string;
  afterValue: string;
  locationBefore?: string;
  locationAfter?: string;
  reason: string;
}

export type LunchTime = "11:00" | "11:30" | "12:00" | "12:30";

// Minute-aware lunch slot for school-specific windows
export interface LunchSlotDetail {
  label: LunchTime;              // The closest canonical slot for compatibility
  startMinute: number;           // Actual start time in minutes from midnight
  endMinute: number;             // Actual end time in minutes from midnight
  source: "clinic" | "school";   // Where this lunch window comes from
  schoolId?: string;             // School ID if source is "school"
}

// Staff lunch assignment with minute-level detail
export interface StaffLunchAssignment {
  staffId: string;
  lunchSlot: LunchSlotDetail;
  coversSlot: LunchSlotDetail;   // The slot this staff can provide coverage for
}

export interface LunchCoverageError {
  clientId: string;
  clientName: string;
  lunchSlot: LunchTime;
  reason: string;
}

export interface ScheduleEngineResult {
  schedule: StaffSchedule[];
  pendingSubApprovals: ApprovalRequest[];
  changes: ScheduleChangeEntry[];
  lunchCoverageErrors: LunchCoverageError[];
  trainingSessionUpdates?: TrainingSessionUpdate[];
}

export interface ApprovedSub {
  clientId: string;
  block: "AM" | "PM";
  subStaffId: string;
}

export interface LunchGroup {
  lunchAt1100: string[];
  lunchAt1130: string[];
  lunchAt1200: string[];
  lunchAt1230: string[];
  staffLunchTimes: Map<string, LunchTime>;
  // Minute-aware assignments for school-specific lunch windows
  staffLunchDetails: Map<string, LunchSlotDetail>;
  // Map of schoolId -> school lunch window info
  schoolLunchWindows: Map<string, { startMinute: number; endMinute: number; firstSlot: LunchSlotDetail; secondSlot: LunchSlotDetail }>;
}

export type LunchSlot = "first" | "second"; // first = 11:30-12:00 / school 1st, second = 12:00-12:30 / school 2nd

export interface ClientCoverageNeed {
  clientId: string;
  clientName: string;
  originalStaffId: string;
  canBeGrouped: boolean;
  allowedLunchPeerIds: string[];
  noFirstLunchPeerIds: string[];
  noSecondLunchPeerIds: string[];
  allowGroupsOf3: boolean;
  allowGroupsOf4: boolean;
  disallowedGroupCombos: string[];
  isGroupLeader: boolean;
  groupLeaderName: string | null;
  groupLeaderNameFirstLunch: string | null;
  groupLeaderNameSecondLunch: string | null;
  excludedStaffForSplit?: string; // AM staff excluded from covering split-location client at PM location
}

export interface UncoveredGap {
  clientId: string;
  clientName: string;
  block: "AM" | "PM";
  originalStaffId?: string;
  originalStaffName?: string;
}

export interface CancelCandidate {
  clientId: string;
  clientName: string;
  client: Client;
  affectedBlocks: ("AM" | "PM")[];
  lastCanceledDate: string | null;
  isProtected: boolean;
  protectionReason?: string;
  skipReason?: string;
  isSkipped: boolean;
  linkedClientIds: string[];
  cancelAllDayOnly: boolean;
  canBeGrouped: boolean;
  sessionsPerWeek: number;
  cancelSkipUsed: boolean;
  consecutiveAbsentDays: number;
}

export interface CancelDecision {
  targetClientId: string;
  targetClientName: string;
  timing: CancelTiming;
  linkedClientIds: string[];
  block: "AM" | "PM" | "ALL_DAY";
  reason: string;
  skippedClients: { clientId: string; clientName: string; skipReason: string }[];
}

export interface LunchCoverageResult {
  slot1100Coverage: Map<string, { clientIds: string[], clientNames: string[], clientOriginalStaff: Map<string, string> }>;
  slot1130Coverage: Map<string, { clientIds: string[], clientNames: string[], clientOriginalStaff: Map<string, string> }>;
  slot1200Coverage: Map<string, { clientIds: string[], clientNames: string[], clientOriginalStaff: Map<string, string> }>;
  slot1230Coverage: Map<string, { clientIds: string[], clientNames: string[], clientOriginalStaff: Map<string, string> }>;
  errors: LunchCoverageError[];
  updatedLunchGroups: LunchGroup;
}

export interface EngineContext {
  allStaff: Staff[];
  allClients: Client[];
  templateAssignments: TemplateAssignment[];
  clientLocations: ClientLocation[];
  schools: School[];
  cancelLinks: ClientCancelLink[];
  trainingSessions: SchedulerTrainingSession[];
  exceptions: Exception[];
  approvedSubs: ApprovedSub[];
  dayOfWeek: number;
  dayKey: WeekDay;
  template: WeeklyTemplate;
  unavailableClients: Set<string>;
  outStaffIds: Set<string>;
  eligibleStaff: Staff[];
  sortedStaff: Staff[];
}
