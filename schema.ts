import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("rbt"),
  staffId: varchar("staff_id"),
  displayName: text("display_name"),
  email: text("email"),
  active: boolean("active").notNull().default(true),
});

const validRoles = ["clinical_manager", "lead_bcba", "bcba", "admin", "lead_rbt", "rbt", "caregiver"] as const;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  staffId: true,
  displayName: true,
  email: true,
}).extend({
  role: z.enum(validRoles).default("rbt"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Schools Table - Reusable school locations with custom lunch windows
export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  hasAlternativeLunch: boolean("has_alternative_lunch").notNull().default(false),
  lunchWindowStartMinute: integer("lunch_window_start_minute").notNull().default(690), // Default 11:30 (690 min from midnight)
  lunchWindowEndMinute: integer("lunch_window_end_minute").notNull().default(750), // Default 12:30 (750 min from midnight)
});

export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
});

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

// Staff Table
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  startDate: text("start_date").notNull(),
  assignedBcbaId: varchar("assigned_bcba_id"),
  assignedLeadId: varchar("assigned_lead_id"), // For BCBAs: assigned Lead RBT
  
  role: text("role").notNull(), // "BT" | "RBT" | "Float" | "Lead RBT" | "BCBA" | "Lead BCBA" | "Admin" | "Clinical Manager"
  subEligible: boolean("sub_eligible").notNull().default(false),
  
  // Supervision hierarchy fields
  programSupervisorId: varchar("program_supervisor_id"), // BCBA: references Lead BCBA who supervises them
  clinicalSupervisorId: varchar("clinical_supervisor_id"), // BCBA/Admin: references Clinical Manager who supervises them
  allowQuadrupleBilling: boolean("allow_quadruple_billing").notNull().default(false), // Staff can cover 4 clients during 11:30-12:00 lunch as last resort
  noCrisisCoverage: boolean("no_crisis_coverage").notNull().default(false), // Staff cannot be scheduled with crisis clients
  noCrisisCoverageEndDate: text("no_crisis_coverage_end_date"), // Optional end date for no crisis coverage restriction
  leadLevel: integer("lead_level"), // 1 | 2 | 3, only if role === "Lead RBT"
  notBtNonbillable: boolean("not_bt_nonbillable").notNull().default(false), // Lead RBT only: no longer practicing BT/RBT, can only provide nonbillable coverage
  nonBillableMidday: boolean("non_billable_midday").notNull().default(false), // BT only: can group bill with another client during lunch if past 60 days/6 months
  
  btCertificationDate: text("bt_certification_date"),
  rbtCertificationDate: text("rbt_certification_date"),
  
  availability: jsonb("availability").notNull(), // WeeklyAvailability object
  
  // Lead RBT specific fields
  bxSupportEnabled: boolean("bx_support_enabled").notNull().default(false), // Toggle for BX support display
  bxSupportClientId: varchar("bx_support_client_id"), // If set, shows "Lead/[Client] Support" instead of "Lead/BX Support"
  isSchoolStaff: boolean("is_school_staff").notNull().default(false), // Toggle for school staff
  schoolAssignments: jsonb("school_assignments"), // { mon: { location: "clinic" | "school", schoolId?: string }, tue: {...}, ... }
  bcbaPrepEnabled: boolean("bcba_prep_enabled").notNull().default(false), // Level 3 only: toggle for BCBA prep
  bcbaPrepSchedule: jsonb("bcba_prep_schedule"), // { mon: { am: boolean, pm: boolean }, tue: {...}, ... }
  
  // Contact Information
  homeAddress: text("home_address"), // Staff home address for on-call drive time estimation
  phoneContacts: jsonb("phone_contacts").notNull().default([]), // Array of { id, type, number, emergencyName?, emergencyRelationship? }
  
  // Training Fields
  isTrainer: boolean("is_trainer").notNull().default(false), // Can this staff member train others
  signOffPermitted: boolean("sign_off_permitted").notNull().default(false), // Lead RBT only: can sign off trainees
  hireDate: text("hire_date"), // Date staff was hired (for New Hire status)
  newHireOverride: boolean("new_hire_override").notNull().default(false), // Disable New Hire protection even if within 30 days
  noLunch: boolean("no_lunch").notNull().default(false), // Staff does not take a lunch break (hard constraint)
  
  // Medical break fields
  breakRequired: boolean("break_required").notNull().default(false), // Staff needs a medically necessary break
  breakDuration: integer("break_duration"), // Duration in minutes (15 or 30), null if breakRequired is false
  
  // Late lunch toggle
  noLateLunches: boolean("no_late_lunches").notNull().default(false), // If ON, mandatory late lunch rule does not apply
});

// Phone contact type definition
export interface StaffPhoneContact {
  id: string;
  type: 'home' | 'cell' | 'work' | 'emergency';
  number: string;
  emergencyName?: string; // Only for type === 'emergency'
  emergencyRelationship?: string; // Only for type === 'emergency'
}

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
});

export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

// Clinical Manager to Lead BCBA supervision links (many-to-many)
export const cmLeadBcbaLinks = pgTable("cm_lead_bcba_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicalManagerId: varchar("clinical_manager_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  leadBcbaId: varchar("lead_bcba_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
});

export const insertCmLeadBcbaLinkSchema = createInsertSchema(cmLeadBcbaLinks).omit({
  id: true,
});

export type InsertCmLeadBcbaLink = z.infer<typeof insertCmLeadBcbaLinkSchema>;
export type CmLeadBcbaLink = typeof cmLeadBcbaLinks.$inferSelect;

// Clinical Manager to Admin supervision links (many-to-many)
export const cmAdminLinks = pgTable("cm_admin_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicalManagerId: varchar("clinical_manager_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  adminId: varchar("admin_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
});

export const insertCmAdminLinkSchema = createInsertSchema(cmAdminLinks).omit({
  id: true,
});

export type InsertCmAdminLink = z.infer<typeof insertCmAdminLinkSchema>;
export type CmAdminLink = typeof cmAdminLinks.$inferSelect;

// Lead RBT to BCBA assignment links (many-to-many) - Lead RBTs can be shared between BCBAs
export const leadRbtBcbaLinks = pgTable("lead_rbt_bcba_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadRbtId: varchar("lead_rbt_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  bcbaId: varchar("bcba_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
});

export const insertLeadRbtBcbaLinkSchema = createInsertSchema(leadRbtBcbaLinks).omit({
  id: true,
});

export type InsertLeadRbtBcbaLink = z.infer<typeof insertLeadRbtBcbaLinkSchema>;
export type LeadRbtBcbaLink = typeof leadRbtBcbaLinks.$inferSelect;

// Client Locations Table - Multiple service locations per client
export const clientLocations = pgTable("client_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  locationType: text("location_type").notNull(), // "clinic" | "home" | "school" | "community" | "other"
  displayName: text("display_name"), // Optional custom name like "Main Clinic" or "Grandma's House"
  address: text("address"), // Physical address
  driveTimeMinutes: integer("drive_time_minutes").notNull().default(0), // Drive time to/from clinic
  isPrimary: boolean("is_primary").notNull().default(false), // Primary/default location
  sortOrder: integer("sort_order").notNull().default(0), // For ordering in UI
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: 'set null' }), // Link to school for school locations
  serviceStartDate: text("service_start_date"), // Date services started at this location (for 30-day cancel protection)
});

export const insertClientLocationSchema = createInsertSchema(clientLocations).omit({
  id: true,
});

export type InsertClientLocation = z.infer<typeof insertClientLocationSchema>;
export type ClientLocation = typeof clientLocations.$inferSelect;

// Client Location Staff Approvals - Which staff can work at each non-clinic location
export const clientLocationStaffApprovals = pgTable("client_location_staff_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientLocationId: varchar("client_location_id").notNull().references(() => clientLocations.id, { onDelete: 'cascade' }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
});

export const insertClientLocationStaffApprovalSchema = createInsertSchema(clientLocationStaffApprovals).omit({
  id: true,
});

export type InsertClientLocationStaffApproval = z.infer<typeof insertClientLocationStaffApprovalSchema>;
export type ClientLocationStaffApproval = typeof clientLocationStaffApprovals.$inferSelect;

// Clients Table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  bcbaId: varchar("bcba_id"),
  phoneNumbers: jsonb("phone_numbers").notNull().default([]), // string[]
  contacts: jsonb("contacts").notNull().default([]), // { name: string, relationship: string, phone: string }[]
  
  // Legacy Location Fields (kept for backward compatibility, use clientLocations table for new data)
  homeAddress: text("home_address"),
  communityAddress: text("community_address"),
  defaultLocation: text("default_location").notNull(), // "clinic" | "home" | "school" | "community" | "other"
  
  // Legacy Drive Time (use clientLocations.driveTimeMinutes for multi-location)
  driveTimeMinutes: integer("drive_time_minutes").notNull().default(0), // 0 | 15 | 30 | 45 | 60
  
  // Staffing Sets (IDs)
  staffingRequirements: text("staffing_requirements"), // Free-form text for requirements like "Female only"
  focusStaffIds: jsonb("focus_staff_ids").notNull().default([]), // string[]
  trainedStaffIds: jsonb("trained_staff_ids").notNull().default([]), // string[]
  lunchCoverageStaffIds: jsonb("lunch_coverage_staff_ids").notNull().default([]), // string[] - Staff who can cover this client during 11:30-12:30 lunch only (no sub approval needed)
  lunchCoverageExcludedStaffIds: jsonb("lunch_coverage_excluded_staff_ids").notNull().default([]), // string[] - Staff excluded from lunch coverage (e.g., to give them a break)
  floatRbtsAllowed: boolean("float_rbts_allowed").notNull().default(false),
  allowedFloatRbtIds: jsonb("allowed_float_rbt_ids").notNull().default([]), // string[] - specific Float RBTs allowed
  leadRbtsAllowed: boolean("lead_rbts_allowed").notNull().default(true),
  allowedLeadRbtIds: jsonb("allowed_lead_rbt_ids").notNull().default([]), // string[] - specific Lead RBTs allowed
  noLongerTrainedIds: jsonb("no_longer_trained_ids").notNull().default([]), // string[]
  excludedStaffIds: jsonb("excluded_staff_ids").notNull().default([]), // string[]
  
  // Constraints
  allowAllDaySameStaff: boolean("allow_all_day_same_staff").notNull().default(false),
  allowSub: boolean("allow_sub").notNull().default(false),
  allowSplits: boolean("allow_splits").notNull().default(false), // Engine can dynamically split this client for coverage
  allowBtPast60Days: boolean("allow_bt_past_60_days").notNull().default(false),
  allowBtPast6Months: boolean("allow_bt_past_6_months").notNull().default(false),
  isCrisisClient: boolean("is_crisis_client").notNull().default(false), // Marker for crisis clients (future use)
  
  // Split Lock (required handoff during session)
  splitLockEnabled: boolean("split_lock_enabled").notNull().default(false), // Client MUST have a staff handoff
  splitWindowStartMinute: integer("split_window_start_minute"), // Start of allowed handoff window (minutes from midnight)
  splitWindowEndMinute: integer("split_window_end_minute"), // End of allowed handoff window (minutes from midnight)
  minSplitDurationMinutes: integer("min_split_duration_minutes").notNull().default(30), // Minimum segment length
  
  // Training
  allowedTrainerIds: jsonb("allowed_trainer_ids").notNull().default([]), // string[]
  leadSignOffAllowed: boolean("lead_sign_off_allowed").notNull().default(false),
  trainingStyle: text("training_style").notNull(), // "half" | "full" | "double"
  
  // Lunch Coverage
  canBeGrouped: boolean("can_be_grouped").notNull().default(false),
  allowedLunchPeerIds: jsonb("allowed_lunch_peer_ids").notNull().default([]), // string[]
  noFirstLunchPeerIds: jsonb("no_first_lunch_peer_ids").notNull().default([]), // string[] - peers that CANNOT pair in first lunch (11:30-12:00 clinic or school 1st lunch)
  noSecondLunchPeerIds: jsonb("no_second_lunch_peer_ids").notNull().default([]), // string[] - peers that CANNOT pair in second lunch (12:00-12:30 clinic or school 2nd lunch)
  allowGroupsOf3: boolean("allow_groups_of_3").notNull().default(false),
  allowGroupsOf4: boolean("allow_groups_of_4").notNull().default(false), // Allow client to be grouped with up to 3 other clients (group of 4)
  allowQuadrupleBilling: boolean("allow_quadruple_billing").notNull().default(false), // Last resort: can be grouped with 3 other clients during 11:30-12:00 lunch
  disallowedGroupCombos: jsonb("disallowed_group_combos").notNull().default([]), // string[]
  
  // Group Leader - Staff can be designated as a group leader for this client
  isGroupLeader: boolean("is_group_leader").notNull().default(false), // If true, staff assigned to this client is a group leader
  groupLeaderName: text("group_leader_name"), // Name of the group (e.g., "motor room", "centers", "PreK") - legacy field
  groupLeaderNameFirstLunch: text("group_leader_name_first_lunch"), // Group name for 11:30-12:00 lunch
  groupLeaderNameSecondLunch: text("group_leader_name_second_lunch"), // Group name for 12:00-12:30 lunch
  
  // Engine Support Fields
  lastCanceledDate: text("last_canceled_date"),
  
  // Cancel Settings
  cancelAllDayOnly: boolean("cancel_all_day_only").notNull().default(false), // Client can only be cancelled for full day, not partial
  criticalCancelNotes: text("critical_cancel_notes"), // Important notes shown in caregiver contact popup when cancelling
  sessionsPerWeek: integer("sessions_per_week").notNull().default(5), // Number of therapy sessions per week (for 2-day skip rule)
  cancelSkipUsed: boolean("cancel_skip_used").notNull().default(false), // Tracks if client used their 2-day skip (clears after they're cancelled)
  lastSkippedDate: text("last_skipped_date"), // Date when client was last skipped in cancel selection (clears when cancelled)
  consecutiveAbsentDays: integer("consecutive_absent_days").notNull().default(0), // Running count of consecutive fully absent days
  daysBackSinceAbsence: integer("days_back_since_absence").notNull().default(0), // Days attended since returning from 5+ day absence (need 3 to clear skip)
  
  // Schedule
  schedule: jsonb("schedule").notNull(), // WeeklyAvailability object
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Client Cancel Links Table - Bidirectional sibling cancellation links
export const clientCancelLinks = pgTable("client_cancel_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  linkedClientId: varchar("linked_client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
});

export const insertClientCancelLinkSchema = createInsertSchema(clientCancelLinks).omit({
  id: true,
});

export type InsertClientCancelLink = z.infer<typeof insertClientCancelLinkSchema>;
export type ClientCancelLink = typeof clientCancelLinks.$inferSelect;

// Template Assignments Table
export const templateAssignments = pgTable("template_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekDay: text("week_day").notNull(), // "mon" | "tue" | "wed" | "thu" | "fri"
  timeBlock: text("time_block").notNull(), // "AM" | "PM"
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }), // null means Unassigned
  
  // Multi-location session support (optional - for clients with multiple service locations)
  locationId: varchar("location_id").references(() => clientLocations.id, { onDelete: 'set null' }), // Which location for this session
  startMinute: integer("start_minute"), // Precise start time in minutes from midnight (e.g., 510 = 8:30 AM)
  endMinute: integer("end_minute"), // Precise end time in minutes from midnight (e.g., 720 = 12:00 PM)
  
  // Focus staff lock - prevents engine from moving this staff away without approval
  isLocked: boolean("is_locked").default(false),
  
  // Drive segment marker - indicates staff is driving between locations
  isDrive: boolean("is_drive").default(false),
});

export const insertTemplateAssignmentSchema = createInsertSchema(templateAssignments).omit({
  id: true,
});

export type InsertTemplateAssignment = z.infer<typeof insertTemplateAssignmentSchema>;
export type TemplateAssignment = typeof templateAssignments.$inferSelect;

// Schedule Changes Table - Change Log
export const scheduleChanges = pgTable("schedule_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(), // YYYY-MM-DD
  timeBlock: text("time_block").notNull(), // "8:00-8:30", "AM", "PM", etc.
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: 'set null' }),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  
  changeType: text("change_type").notNull(), // "assignment" | "location" | "status" | "sub"
  source: text("source").notNull(), // "exception" | "repair" | "sub" | "manual" | "template"
  
  beforeValue: text("before_value"), // What it was before
  afterValue: text("after_value"), // What it is now
  
  locationBefore: text("location_before"), // For location changes
  locationAfter: text("location_after"),
  
  reason: text("reason").notNull(), // Human-readable explanation
  
  exceptionId: varchar("exception_id"), // Link to exception if applicable
  approvalId: varchar("approval_id"), // Link to approval if applicable
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertScheduleChangeSchema = createInsertSchema(scheduleChanges).omit({
  id: true,
  createdAt: true,
});

export type InsertScheduleChange = z.infer<typeof insertScheduleChangeSchema>;
export type ScheduleChange = typeof scheduleChanges.$inferSelect;

// Daily Schedules Table - Versioned schedule snapshots
export const dailySchedules = pgTable("daily_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(), // YYYY-MM-DD
  version: integer("version").notNull(), // Incrementing version number
  
  // Snapshot data stored as JSON
  snapshot: jsonb("snapshot").notNull(), // { assignments, exceptions, approvals }
  
  // Metadata
  label: text("label"), // "generated" | "reset" | "rewind" | custom label
  derivedFromVersion: integer("derived_from_version"), // Which version this was based on
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDailyScheduleSchema = createInsertSchema(dailySchedules).omit({
  id: true,
  createdAt: true,
});

export type InsertDailySchedule = z.infer<typeof insertDailyScheduleSchema>;
export type DailySchedule = typeof dailySchedules.$inferSelect;

// Snapshot type for frontend/backend use
export interface ScheduleSnapshot {
  staffSchedules: Array<{
    staffId: string;
    staffName: string;
    slots: Array<{
      block: string;
      value: string;
      clientId?: string;
      status: string;
      reason?: string;
      source?: string;
      location?: string;
    }>;
  }>;
  exceptions: Array<{
    id: string;
    type: string;
    entityId: string;
    mode: string;
    allDay: boolean;
    timeWindow?: { start: string; end: string };
    locationOverride?: string;
  }>;
  approvals: Array<{
    id: string;
    type: string;
    relatedId: string;
    status: string;
  }>;
}

// Training Plans Table - A training plan for a staff-client pair
export const trainingPlans = pgTable("training_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traineeId: varchar("trainee_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  
  trackType: text("track_type").notNull(), // "caseload_change" | "new_hire" | "additional"
  priority: integer("priority").notNull().default(0), // Order in P1 queue (lower = higher priority)
  
  trainingStyle: text("training_style").notNull(), // "half" | "full" | "double" | "expedited" - can override client default
  
  status: text("status").notNull().default("active"), // "active" | "completed" | "paused" | "cancelled"
  
  preferredTrainerId: varchar("preferred_trainer_id").references(() => staff.id, { onDelete: 'set null' }),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const insertTrainingPlanSchema = createInsertSchema(trainingPlans).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertTrainingPlan = z.infer<typeof insertTrainingPlanSchema>;
export type TrainingPlan = typeof trainingPlans.$inferSelect;

// Training Sessions Table - Individual training sessions within a plan
export const trainingSessions = pgTable("training_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => trainingPlans.id, { onDelete: 'cascade' }),
  
  stageType: text("stage_type").notNull(), // "shadow" | "support" | "sign_off" | "shadow_support" (half session split)
  stageOrder: integer("stage_order").notNull(), // 1, 2, 3... sequence within the plan
  
  scheduledDate: text("scheduled_date"), // YYYY-MM-DD when scheduled
  scheduledBlock: text("scheduled_block"), // "AM" | "PM"
  
  status: text("status").notNull().default("planned"), // "planned" | "completed" | "confirmed" | "disrupted" | "blocked" | "skipped"
  
  trainerId: varchar("trainer_id").references(() => staff.id, { onDelete: 'set null' }), // Who is doing the training
  supervisorId: varchar("supervisor_id").references(() => staff.id, { onDelete: 'set null' }), // BCBA or lead for sign-off
  
  blockReason: text("block_reason"), // Why blocked if status is "blocked"
  disruptReason: text("disrupt_reason"), // Why disrupted if status is "disrupted"
  
  confirmedAt: timestamp("confirmed_at"), // When sign-off was confirmed
  confirmedById: varchar("confirmed_by_id").references(() => staff.id, { onDelete: 'set null' }),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertTrainingSessionSchema = createInsertSchema(trainingSessions).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
});

export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type TrainingSession = typeof trainingSessions.$inferSelect;

// Training Style enum and stage sequence generator
export type TrainingStyleType = "half" | "full" | "double" | "expedited";
export type TrainingStageType = "shadow" | "support" | "sign_off" | "shadow_support";

export function getStageSequence(style: TrainingStyleType): TrainingStageType[] {
  switch (style) {
    case "half":
      return ["shadow_support", "sign_off"];
    case "full":
      return ["shadow", "support", "sign_off"];
    case "double":
      return ["shadow", "shadow", "support", "support", "sign_off"];
    case "expedited":
      return ["sign_off"];
    default:
      return ["shadow", "support", "sign_off"];
  }
}

// Client Cancel History - Tracks when clients were cancelled
export const clientCancelHistory = pgTable("client_cancel_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text("date").notNull(), // YYYY-MM-DD format
  timeBlock: text("time_block").notNull(), // "AM" | "PM" | "FULL_DAY"
  reason: text("reason"), // Optional reason for cancellation
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertClientCancelHistorySchema = createInsertSchema(clientCancelHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertClientCancelHistory = z.infer<typeof insertClientCancelHistorySchema>;
export type ClientCancelHistory = typeof clientCancelHistory.$inferSelect;

// Client Sub History - Tracks when clients were covered by subs
export const clientSubHistory = pgTable("client_sub_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text("date").notNull(), // YYYY-MM-DD format
  timeBlock: text("time_block").notNull(), // "AM" | "PM"
  subStaffId: varchar("sub_staff_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  originalStaffId: varchar("original_staff_id").references(() => staff.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertClientSubHistorySchema = createInsertSchema(clientSubHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertClientSubHistory = z.infer<typeof insertClientSubHistorySchema>;
export type ClientSubHistory = typeof clientSubHistory.$inferSelect;

// Client Skip History - Tracks when clients were skipped in cancel selection
export const clientSkipHistory = pgTable("client_skip_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text("date").notNull(), // YYYY-MM-DD format
  skipReason: text("skip_reason").notNull(), // e.g., "2-sessions/week skip" or "5-day absence skip"
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertClientSkipHistorySchema = createInsertSchema(clientSkipHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertClientSkipHistory = z.infer<typeof insertClientSkipHistorySchema>;
export type ClientSkipHistory = typeof clientSkipHistory.$inferSelect;

// Ideal Day Templates - Complete pre-authored schedule for each weekday
export const idealDayTemplates = pgTable("ideal_day_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekDay: text("week_day").notNull().unique(), // "mon" | "tue" | "wed" | "thu" | "fri"
  isComplete: boolean("is_complete").notNull().default(false), // Has admin finished editing this day
  notes: text("notes"), // Optional notes about this day's schedule
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertIdealDayTemplateSchema = createInsertSchema(idealDayTemplates).omit({
  id: true,
  updatedAt: true,
});

export type InsertIdealDayTemplate = z.infer<typeof insertIdealDayTemplateSchema>;
export type IdealDayTemplate = typeof idealDayTemplates.$inferSelect;

// Ideal Day Segments - Individual time segments for each staff member
export const idealDaySegments = pgTable("ideal_day_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => idealDayTemplates.id, { onDelete: 'cascade' }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  
  // Timing
  startMinute: integer("start_minute").notNull(), // Minutes from midnight (e.g., 450 = 7:30 AM)
  endMinute: integer("end_minute").notNull(), // Minutes from midnight (e.g., 960 = 4:00 PM)
  
  // Segment Type
  segmentType: text("segment_type").notNull(), // "client" | "lunch" | "drive" | "break" | "on_call" | "lead_support" | "open" | "out"
  
  // Client Assignment (for segmentType === "client")
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  locationId: varchar("location_id").references(() => clientLocations.id, { onDelete: 'set null' }),
  
  // Lunch Pairing (for segmentType === "lunch")
  lunchPeriod: text("lunch_period"), // "first" (11:30-12:00) | "second" (12:00-12:30) | "late" (12:30-1:00)
  lunchPairingGroupId: varchar("lunch_pairing_group_id"), // Reference to template_lunch_pairing_groups
  
  // Display
  displayValue: text("display_value"), // Override display text (e.g., custom drive note)
  reason: text("reason"), // Reason/notes for this segment
  
  // Origin tracking - "generated" from template or "manual" entry
  origin: text("origin").notNull().default("manual"), // "generated" | "manual"
  sourceAssignmentId: varchar("source_assignment_id"), // Link back to template assignment (if generated)
  
  sortOrder: integer("sort_order").notNull().default(0), // Order within the day for this staff
});

export const insertIdealDaySegmentSchema = createInsertSchema(idealDaySegments).omit({
  id: true,
});

export type InsertIdealDaySegment = z.infer<typeof insertIdealDaySegmentSchema>;
export type IdealDaySegment = typeof idealDaySegments.$inferSelect;

// Ideal Day Lunch Pairings - Which clients are grouped during lunch
export const idealDayLunchPairings = pgTable("ideal_day_lunch_pairings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => idealDayTemplates.id, { onDelete: 'cascade' }),
  
  lunchPeriod: text("lunch_period").notNull(), // "first" (11:30-12:00) | "second" (12:00-12:30)
  
  // Staff covering this group
  coveringStaffId: varchar("covering_staff_id").notNull().references(() => staff.id, { onDelete: 'cascade' }),
  
  // Clients in this pairing (1-4 clients)
  clientIds: text("client_ids").array().notNull().default([]), // string[] - client IDs in this group
  
  // Group info
  groupName: text("group_name"), // Display name for group (e.g., "Group A", "Blue Table")
  isSolo: boolean("is_solo").notNull().default(false), // Client eats alone
  
  // Group leader info
  isGroupLeader: boolean("is_group_leader").notNull().default(false),
  groupLeaderName: text("group_leader_name"), // Display name for group leader tag
  
  // Location
  locationId: varchar("location_id").references(() => clientLocations.id, { onDelete: 'set null' }),
});

export const insertIdealDayLunchPairingSchema = createInsertSchema(idealDayLunchPairings).omit({
  id: true,
});

export type InsertIdealDayLunchPairing = z.infer<typeof insertIdealDayLunchPairingSchema>;
export type IdealDayLunchPairing = typeof idealDayLunchPairings.$inferSelect;

// Segment type constants
export const SEGMENT_TYPES = ["client", "lunch", "drive", "break", "on_call", "lead_support", "open", "out"] as const;
export type SegmentType = typeof SEGMENT_TYPES[number];

// Segment origin constants
export const SEGMENT_ORIGINS = ["generated", "manual"] as const;
export type SegmentOrigin = typeof SEGMENT_ORIGINS[number];

// Default timing constants for schedule generation
export const SCHEDULE_TIMING = {
  // AM session defaults
  AM_START: 510, // 8:30 AM
  AM_END: 690, // 11:30 AM
  
  // PM session defaults
  PM_START: 780, // 1:00 PM
  PM_END: 960, // 4:00 PM
  
  // Lunch periods (minutes from midnight)
  LUNCH_FIRST_START: 690, // 11:30 AM
  LUNCH_FIRST_END: 720, // 12:00 PM
  LUNCH_SECOND_START: 720, // 12:00 PM
  LUNCH_SECOND_END: 750, // 12:30 PM
  LUNCH_LATE_START: 750, // 12:30 PM
  LUNCH_LATE_END: 780, // 1:00 PM
  
  // Drive buffer duration
  DRIVE_BUFFER: 30, // 30 minutes
  
  // Day boundaries
  DAY_START: 420, // 7:00 AM
  DAY_END: 1020, // 5:00 PM
} as const;

// Lunch period constants
export const LUNCH_PERIODS = ["first", "second", "late"] as const;
export type LunchPeriod = typeof LUNCH_PERIODS[number];

// Billing type constants for lunch pairing groups
export const BILLING_TYPES = ["solo", "group", "quad"] as const;
export type BillingType = typeof BILLING_TYPES[number];

// Template Lunch Pairing Groups - Baseline client groupings for lunch coverage
// This is NOT tied to a specific weekday - it's the "menu" of valid pairing options
// The Ideal Day page filters these based on which clients are present on that day
export const templateLunchPairingGroups = pgTable("template_lunch_pairing_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Location context (e.g., Clinic, School A, In Home)
  locationId: varchar("location_id").references(() => clientLocations.id, { onDelete: 'set null' }),
  locationName: text("location_name").notNull(), // Denormalized for display (e.g., "Clinic", "School A")
  
  // Lunch block (first = 11:30-12:00, second = 12:00-12:30)
  lunchBlock: text("lunch_block").notNull(), // "first" | "second"
  
  // Billing type bucket (solo = solo bill only, group = group bill, quad = non-bill quads)
  billingType: text("billing_type").notNull(), // "solo" | "group" | "quad"
  
  // Client IDs in this group (1-4 clients)
  clientIds: text("client_ids").array().notNull().default([]), // string[] - client IDs in this group
  
  // Display name (auto-generated from client initials, e.g., "AR / MP")
  displayName: text("display_name"),
  
  // Sort order within the bucket
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertTemplateLunchPairingGroupSchema = createInsertSchema(templateLunchPairingGroups).omit({
  id: true,
});

export type InsertTemplateLunchPairingGroup = z.infer<typeof insertTemplateLunchPairingGroupSchema>;
export type TemplateLunchPairingGroup = typeof templateLunchPairingGroups.$inferSelect;

// Database Indexes for Performance Optimization
// These are defined here for documentation; actual index creation is in migrations
export const indexDefinitions = {
  templateAssignments: [
    "CREATE INDEX IF NOT EXISTS idx_template_assignments_week_day ON template_assignments(week_day)",
    "CREATE INDEX IF NOT EXISTS idx_template_assignments_staff_id ON template_assignments(staff_id)",
    "CREATE INDEX IF NOT EXISTS idx_template_assignments_client_id ON template_assignments(client_id)",
  ],
  scheduleChanges: [
    "CREATE INDEX IF NOT EXISTS idx_schedule_changes_date ON schedule_changes(date)",
    "CREATE INDEX IF NOT EXISTS idx_schedule_changes_staff_id ON schedule_changes(staff_id)",
    "CREATE INDEX IF NOT EXISTS idx_schedule_changes_client_id ON schedule_changes(client_id)",
  ],
  dailySchedules: [
    "CREATE INDEX IF NOT EXISTS idx_daily_schedules_date ON daily_schedules(date)",
    "CREATE INDEX IF NOT EXISTS idx_daily_schedules_date_version ON daily_schedules(date, version)",
  ],
  trainingSessions: [
    "CREATE INDEX IF NOT EXISTS idx_training_sessions_plan_id ON training_sessions(plan_id)",
    "CREATE INDEX IF NOT EXISTS idx_training_sessions_scheduled_date ON training_sessions(scheduled_date)",
  ],
  clientLocations: [
    "CREATE INDEX IF NOT EXISTS idx_client_locations_client_id ON client_locations(client_id)",
  ],
  clientCancelHistory: [
    "CREATE INDEX IF NOT EXISTS idx_client_cancel_history_client_id ON client_cancel_history(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_client_cancel_history_date ON client_cancel_history(date)",
  ],
  clientSubHistory: [
    "CREATE INDEX IF NOT EXISTS idx_client_sub_history_client_id ON client_sub_history(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_client_sub_history_date ON client_sub_history(date)",
  ],
  clientSkipHistory: [
    "CREATE INDEX IF NOT EXISTS idx_client_skip_history_client_id ON client_skip_history(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_client_skip_history_date ON client_skip_history(date)",
  ],
  idealDayTemplates: [
    "CREATE INDEX IF NOT EXISTS idx_ideal_day_templates_week_day ON ideal_day_templates(week_day)",
  ],
  idealDaySegments: [
    "CREATE INDEX IF NOT EXISTS idx_ideal_day_segments_template_id ON ideal_day_segments(template_id)",
    "CREATE INDEX IF NOT EXISTS idx_ideal_day_segments_staff_id ON ideal_day_segments(staff_id)",
    "CREATE INDEX IF NOT EXISTS idx_ideal_day_segments_client_id ON ideal_day_segments(client_id)",
  ],
  idealDayLunchPairings: [
    "CREATE INDEX IF NOT EXISTS idx_ideal_day_lunch_pairings_template_id ON ideal_day_lunch_pairings(template_id)",
    "CREATE INDEX IF NOT EXISTS idx_ideal_day_lunch_pairings_covering_staff_id ON ideal_day_lunch_pairings(covering_staff_id)",
  ],
  templateLunchPairingGroups: [
    "CREATE INDEX IF NOT EXISTS idx_template_lunch_pairing_groups_location ON template_lunch_pairing_groups(location_id)",
    "CREATE INDEX IF NOT EXISTS idx_template_lunch_pairing_groups_lunch_block ON template_lunch_pairing_groups(lunch_block)",
    "CREATE INDEX IF NOT EXISTS idx_template_lunch_pairing_groups_billing_type ON template_lunch_pairing_groups(billing_type)",
  ],
};
