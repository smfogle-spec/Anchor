import type { Staff, Client, TemplateAssignment, ClientLocation, School, ClientCancelLink } from "@shared/schema";
import type { SchedulerTrainingSession } from "../schedule-engine";

let idCounter = 0;
function generateId(): string {
  return `test-id-${++idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function createStaff(overrides: Partial<Staff> = {}): Staff {
  const id = overrides.id || generateId();
  return {
    id,
    name: overrides.name || `Staff ${id}`,
    active: overrides.active ?? true,
    startDate: overrides.startDate || "2024-01-01",
    assignedBcbaId: overrides.assignedBcbaId || null,
    assignedLeadId: overrides.assignedLeadId || null,
    programSupervisorId: overrides.programSupervisorId || null,
    clinicalSupervisorId: overrides.clinicalSupervisorId || null,
    role: overrides.role || "RBT",
    subEligible: overrides.subEligible ?? false,
    allowQuadrupleBilling: overrides.allowQuadrupleBilling ?? false,
    noCrisisCoverage: overrides.noCrisisCoverage ?? false,
    noCrisisCoverageEndDate: overrides.noCrisisCoverageEndDate || null,
    leadLevel: overrides.leadLevel || null,
    notBtNonbillable: overrides.notBtNonbillable ?? false,
    nonBillableMidday: overrides.nonBillableMidday ?? false,
    btCertificationDate: overrides.btCertificationDate || null,
    rbtCertificationDate: overrides.rbtCertificationDate || null,
    availability: overrides.availability || {
      mon: { available: true, start: "08:00", end: "16:00" },
      tue: { available: true, start: "08:00", end: "16:00" },
      wed: { available: true, start: "08:00", end: "16:00" },
      thu: { available: true, start: "08:00", end: "16:00" },
      fri: { available: true, start: "08:00", end: "16:00" },
    },
    bxSupportEnabled: overrides.bxSupportEnabled ?? false,
    bxSupportClientId: overrides.bxSupportClientId || null,
    isSchoolStaff: overrides.isSchoolStaff ?? false,
    schoolAssignments: overrides.schoolAssignments || null,
    bcbaPrepEnabled: overrides.bcbaPrepEnabled ?? false,
    bcbaPrepSchedule: overrides.bcbaPrepSchedule || null,
    homeAddress: overrides.homeAddress || null,
    phoneContacts: overrides.phoneContacts || [],
    isTrainer: overrides.isTrainer ?? false,
    signOffPermitted: overrides.signOffPermitted ?? false,
    hireDate: overrides.hireDate || null,
    newHireOverride: overrides.newHireOverride ?? false,
    noLunch: overrides.noLunch ?? false,
    breakRequired: overrides.breakRequired ?? false,
    breakDuration: overrides.breakDuration ?? null,
    noLateLunches: overrides.noLateLunches ?? false,
  };
}

export function createClient(overrides: Partial<Client> = {}): Client {
  const id = overrides.id || generateId();
  return {
    id,
    name: overrides.name || `Client ${id}`,
    active: overrides.active ?? true,
    bcbaId: overrides.bcbaId || null,
    phoneNumbers: overrides.phoneNumbers || [],
    contacts: overrides.contacts || [],
    homeAddress: overrides.homeAddress || null,
    communityAddress: overrides.communityAddress || null,
    defaultLocation: overrides.defaultLocation || "clinic",
    driveTimeMinutes: overrides.driveTimeMinutes ?? 0,
    staffingRequirements: overrides.staffingRequirements || null,
    focusStaffIds: overrides.focusStaffIds || [],
    trainedStaffIds: overrides.trainedStaffIds || [],
    lunchCoverageStaffIds: overrides.lunchCoverageStaffIds || [],
    lunchCoverageExcludedStaffIds: overrides.lunchCoverageExcludedStaffIds || [],
    floatRbtsAllowed: overrides.floatRbtsAllowed ?? true,
    allowedFloatRbtIds: overrides.allowedFloatRbtIds || [],
    leadRbtsAllowed: overrides.leadRbtsAllowed ?? true,
    allowedLeadRbtIds: overrides.allowedLeadRbtIds || [],
    noLongerTrainedIds: overrides.noLongerTrainedIds || [],
    excludedStaffIds: overrides.excludedStaffIds || [],
    allowAllDaySameStaff: overrides.allowAllDaySameStaff ?? true,
    allowSub: overrides.allowSub ?? true,
    allowSplits: overrides.allowSplits ?? true,
    allowBtPast60Days: overrides.allowBtPast60Days ?? false,
    allowBtPast6Months: overrides.allowBtPast6Months ?? false,
    isCrisisClient: overrides.isCrisisClient ?? false,
    splitLockEnabled: overrides.splitLockEnabled ?? false,
    splitWindowStartMinute: overrides.splitWindowStartMinute ?? null,
    splitWindowEndMinute: overrides.splitWindowEndMinute ?? null,
    minSplitDurationMinutes: overrides.minSplitDurationMinutes ?? 30,
    allowedTrainerIds: overrides.allowedTrainerIds || [],
    leadSignOffAllowed: overrides.leadSignOffAllowed ?? false,
    trainingStyle: overrides.trainingStyle || "half",
    canBeGrouped: overrides.canBeGrouped ?? true,
    allowedLunchPeerIds: overrides.allowedLunchPeerIds || [],
    noFirstLunchPeerIds: overrides.noFirstLunchPeerIds || [],
    noSecondLunchPeerIds: overrides.noSecondLunchPeerIds || [],
    allowGroupsOf3: overrides.allowGroupsOf3 ?? false,
    allowGroupsOf4: overrides.allowGroupsOf4 ?? false,
    allowQuadrupleBilling: overrides.allowQuadrupleBilling ?? false,
    disallowedGroupCombos: overrides.disallowedGroupCombos || [],
    isGroupLeader: overrides.isGroupLeader ?? false,
    groupLeaderName: overrides.groupLeaderName || null,
    groupLeaderNameFirstLunch: overrides.groupLeaderNameFirstLunch || null,
    groupLeaderNameSecondLunch: overrides.groupLeaderNameSecondLunch || null,
    lastCanceledDate: overrides.lastCanceledDate || null,
    cancelAllDayOnly: overrides.cancelAllDayOnly ?? false,
    criticalCancelNotes: overrides.criticalCancelNotes || null,
    sessionsPerWeek: overrides.sessionsPerWeek ?? 5,
    cancelSkipUsed: overrides.cancelSkipUsed ?? false,
    lastSkippedDate: overrides.lastSkippedDate || null,
    consecutiveAbsentDays: overrides.consecutiveAbsentDays ?? 0,
    daysBackSinceAbsence: overrides.daysBackSinceAbsence ?? 0,
    schedule: overrides.schedule || {
      mon: { enabled: true, start: "08:00", end: "16:00" },
      tue: { enabled: true, start: "08:00", end: "16:00" },
      wed: { enabled: true, start: "08:00", end: "16:00" },
      thu: { enabled: true, start: "08:00", end: "16:00" },
      fri: { enabled: true, start: "08:00", end: "16:00" },
    },
  };
}

export function createTemplateAssignment(overrides: Partial<TemplateAssignment> = {}): TemplateAssignment {
  return {
    id: overrides.id || generateId(),
    weekDay: overrides.weekDay || "mon",
    timeBlock: overrides.timeBlock || "AM",
    staffId: overrides.staffId || generateId(),
    clientId: overrides.clientId || null,
    locationId: overrides.locationId || null,
    startMinute: overrides.startMinute || null,
    endMinute: overrides.endMinute || null,
    isLocked: overrides.isLocked || null,
    isDrive: overrides.isDrive || null,
  };
}

export function createClientLocation(overrides: Partial<ClientLocation> = {}): ClientLocation {
  return {
    id: overrides.id || generateId(),
    clientId: overrides.clientId || generateId(),
    locationType: overrides.locationType || "clinic",
    displayName: overrides.displayName || null,
    address: overrides.address || null,
    driveTimeMinutes: overrides.driveTimeMinutes ?? 0,
    isPrimary: overrides.isPrimary ?? false,
    sortOrder: overrides.sortOrder ?? 0,
    schoolId: overrides.schoolId || null,
    serviceStartDate: overrides.serviceStartDate || null,
  };
}

export function createSchool(overrides: Partial<School> = {}): School {
  return {
    id: overrides.id || generateId(),
    name: overrides.name || "Test School",
    hasAlternativeLunch: overrides.hasAlternativeLunch ?? false,
    lunchWindowStartMinute: overrides.lunchWindowStartMinute ?? 690,
    lunchWindowEndMinute: overrides.lunchWindowEndMinute ?? 750,
  };
}

export function createTrainingSession(overrides: Partial<SchedulerTrainingSession> = {}): SchedulerTrainingSession {
  return {
    id: overrides.id || generateId(),
    planId: overrides.planId || generateId(),
    stageOrder: overrides.stageOrder ?? 1,
    stageType: overrides.stageType || "shadow",
    scheduledDate: overrides.scheduledDate || null,
    scheduledBlock: overrides.scheduledBlock || null,
    status: overrides.status || "planned",
    trainerId: overrides.trainerId || null,
    traineeId: overrides.traineeId || null,
    clientId: overrides.clientId || null,
    preferredTrainerId: overrides.preferredTrainerId || null,
    trainingTrack: overrides.trainingTrack || null,
    trainingStyle: overrides.trainingStyle || null,
    planStatus: overrides.planStatus || "active",
  };
}

export function createCancelLink(overrides: Partial<ClientCancelLink> = {}): ClientCancelLink {
  return {
    id: overrides.id || generateId(),
    clientId: overrides.clientId || generateId(),
    linkedClientId: overrides.linkedClientId || generateId(),
  };
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
