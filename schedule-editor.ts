import type { StaffSchedule, ScheduleSlot } from "./schedule-data";
import type { Staff, Client } from "@shared/schema";
import { timeStringToMinutes, minutesToTimeString } from "./schedule-engine/time-utils";

export type EditorMode = "whatif" | "draft";

export type EditType = "change_staff" | "split" | "train" | "cancel" | "tag";

export interface TimeWindow {
  start: string;
  end: string;
}

export interface ChangeStaffEdit {
  type: "change_staff";
  staffId: string;
  clientId: string;
  timeWindow: TimeWindow;
}

export interface SplitSegment {
  clientId: string;
  timeWindow: TimeWindow;
}

export interface SplitEdit {
  type: "split";
  staffId: string;
  segments: SplitSegment[];
}

export interface TrainEdit {
  type: "train";
  traineeId: string;
  clientId: string;
  trainerId: string;
  phase: "shadow" | "support" | "sign_off" | "half" | "expedited";
  timeWindow: TimeWindow;
}

export interface CancelEdit {
  type: "cancel";
  clientId: string;
  cancelType: "all_day" | "cancelled_until" | "cancelled_at";
  time?: string;
}

export interface TagEdit {
  type: "tag";
  staffId: string;
  tagText: string;
  timeWindow: TimeWindow;
}

export type ScheduleEdit = ChangeStaffEdit | SplitEdit | TrainEdit | CancelEdit | TagEdit;

export interface ChangeLogEntry {
  id: string;
  timestamp: Date;
  editType: EditType;
  description: string;
  entities: {
    staffId?: string;
    staffName?: string;
    clientId?: string;
    clientName?: string;
  };
  timeWindow?: TimeWindow;
  triggeredAdvisor: boolean;
  hasWarnings: boolean;
  warningType?: "soft" | "hard";
}

export interface EditorWarning {
  id: string;
  type: "hard" | "soft";
  rule: string;
  description: string;
  entities: {
    staffId?: string;
    staffName?: string;
    clientId?: string;
    clientName?: string;
    time?: string;
  };
  suggestions: string[];
}

export interface AdvisorSuggestion {
  id: string;
  description: string;
  action: () => void;
}

export interface AdvisorState {
  isActive: boolean;
  problem: string;
  suggestions: AdvisorSuggestion[];
}

export interface EditorState {
  mode: EditorMode;
  isOpen: boolean;
  selectedEditType: EditType | null;
  selectedStaffId: string | null;
  selectedClientId: string | null;
  simulationSchedule: StaffSchedule[];
  draftSchedule: StaffSchedule[];
  officialSchedule: StaffSchedule[];
  changeLog: ChangeLogEntry[];
  undoStack: StaffSchedule[][];
  warnings: EditorWarning[];
  advisor: AdvisorState;
  currentEdit: Partial<ScheduleEdit> | null;
}

export function createInitialEditorState(officialSchedule: StaffSchedule[]): EditorState {
  return {
    mode: "whatif",
    isOpen: false,
    selectedEditType: null,
    selectedStaffId: null,
    selectedClientId: null,
    simulationSchedule: JSON.parse(JSON.stringify(officialSchedule)),
    draftSchedule: JSON.parse(JSON.stringify(officialSchedule)),
    officialSchedule: officialSchedule,
    changeLog: [],
    undoStack: [],
    warnings: [],
    advisor: {
      isActive: false,
      problem: "",
      suggestions: []
    },
    currentEdit: null
  };
}

// Re-export consolidated time utilities for backward compatibility
export const parseTimeToMinutes = timeStringToMinutes;
export const formatMinutesToTimeStr = minutesToTimeString;

export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 7; h <= 18; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 18 && m > 0) break;
      options.push(`${h}:${m.toString().padStart(2, "0")}`);
    }
  }
  return options;
}

export function checkHardConstraints(
  edit: ScheduleEdit,
  staffList: Staff[],
  clientList: Client[]
): EditorWarning[] {
  const warnings: EditorWarning[] = [];
  
  if (edit.type === "change_staff") {
    const staff = staffList.find(s => s.id === edit.staffId);
    const client = clientList.find(c => c.id === edit.clientId);
    
    if (staff && client) {
      const excludedStaff = (client.excludedStaffIds as string[]) || [];
      if (Array.isArray(excludedStaff) && excludedStaff.includes(edit.staffId)) {
        warnings.push({
          id: `hard-excluded-${edit.staffId}-${edit.clientId}`,
          type: "hard",
          rule: "Staff Excluded Restriction",
          description: `${staff.name} is excluded from working with ${client.name}`,
          entities: {
            staffId: edit.staffId,
            staffName: staff.name,
            clientId: edit.clientId,
            clientName: client.name
          },
          suggestions: [
            "Select a different staff member",
            "Remove this edit",
            "Check client's excluded staff list"
          ]
        });
      }
      
      if (client.isCrisisClient && staff.role === "Float") {
        warnings.push({
          id: `hard-crisis-${edit.staffId}-${edit.clientId}`,
          type: "hard",
          rule: "No Crisis Clients Restriction",
          description: `${client.name} has crisis restrictions that prevent float staff assignment`,
          entities: {
            staffId: edit.staffId,
            staffName: staff.name,
            clientId: edit.clientId,
            clientName: client.name
          },
          suggestions: [
            "Select trained staff for this client",
            "Remove this edit"
          ]
        });
      }
    }
  }
  
  return warnings;
}

export function checkSoftConstraints(
  edit: ScheduleEdit,
  staffList: Staff[],
  clientList: Client[],
  currentSchedule: StaffSchedule[]
): EditorWarning[] {
  const warnings: EditorWarning[] = [];
  
  if (edit.type === "change_staff") {
    const staff = staffList.find(s => s.id === edit.staffId);
    const client = clientList.find(c => c.id === edit.clientId);
    
    if (staff && client) {
      const trainedStaff = (client.trainedStaffIds as string[]) || [];
      const focusStaff = (client.focusStaffIds as string[]) || [];
      
      if (!Array.isArray(trainedStaff) || !Array.isArray(focusStaff) || 
          (!trainedStaff.includes(edit.staffId) && !focusStaff.includes(edit.staffId))) {
        warnings.push({
          id: `soft-untrained-${edit.staffId}-${edit.clientId}`,
          type: "soft",
          rule: "Untrained Staff Assignment",
          description: `${staff.name} is not in the trained or focus staff list for ${client.name}`,
          entities: {
            staffId: edit.staffId,
            staffName: staff.name,
            clientId: edit.clientId,
            clientName: client.name
          },
          suggestions: [
            "Consider selecting trained staff instead",
            "Proceed if this is intentional"
          ]
        });
      }
    }
  }
  
  return warnings;
}

export function applyChangeStaffEdit(
  schedule: StaffSchedule[],
  edit: ChangeStaffEdit,
  staffList: Staff[],
  clientList: Client[]
): { 
  newSchedule: StaffSchedule[]; 
  needsAdvisor: boolean;
  advisorProblem?: string;
} {
  const newSchedule: StaffSchedule[] = JSON.parse(JSON.stringify(schedule));
  const startMinute = parseTimeToMinutes(edit.timeWindow.start);
  const endMinute = parseTimeToMinutes(edit.timeWindow.end);
  
  const client = clientList.find(c => c.id === edit.clientId);
  const staff = staffList.find(s => s.id === edit.staffId);
  
  if (!client || !staff) {
    return { newSchedule: schedule, needsAdvisor: false };
  }

  let currentlyAssignedStaffId: string | null = null;
  for (const staffSched of newSchedule) {
    for (const slot of staffSched.slots) {
      if (slot.clientId === edit.clientId) {
        const slotStart = slot.startMinute || 0;
        const slotEnd = slot.endMinute || 1440;
        if (slotStart < endMinute && slotEnd > startMinute) {
          currentlyAssignedStaffId = staffSched.staffId;
          break;
        }
      }
    }
    if (currentlyAssignedStaffId) break;
  }

  if (currentlyAssignedStaffId && currentlyAssignedStaffId !== edit.staffId) {
    const oldStaffSched = newSchedule.find(s => s.staffId === currentlyAssignedStaffId);
    if (oldStaffSched) {
      oldStaffSched.slots = oldStaffSched.slots.filter(slot => {
        if (slot.clientId !== edit.clientId) return true;
        const slotStart = slot.startMinute || 0;
        const slotEnd = slot.endMinute || 1440;
        return !(slotStart < endMinute && slotEnd > startMinute);
      });
    }
  }

  let targetStaffSched = newSchedule.find(s => s.staffId === edit.staffId);
  if (!targetStaffSched) {
    const newStaffSched: StaffSchedule = {
      staffId: edit.staffId,
      status: "ACTIVE",
      slots: []
    };
    newSchedule.push(newStaffSched);
    targetStaffSched = newStaffSched;
  }

  const clientInitials = client.name.split(" ").map(n => n[0]).join("");
  const newSlot: ScheduleSlot = {
    id: `manual-${edit.staffId}-${edit.clientId}-${startMinute}`,
    block: startMinute < 720 ? "AM" : "PM",
    value: clientInitials,
    source: "REPAIR",
    reason: "Manual editor change",
    clientId: edit.clientId,
    startMinute,
    endMinute,
    indicator: "Manual"
  };

  targetStaffSched.slots.push(newSlot);

  const needsAdvisor = currentlyAssignedStaffId !== null && currentlyAssignedStaffId !== edit.staffId;
  
  return { 
    newSchedule, 
    needsAdvisor,
    advisorProblem: needsAdvisor 
      ? `${staffList.find(s => s.id === currentlyAssignedStaffId)?.name || "Previous staff"} no longer has an assignment during ${edit.timeWindow.start}-${edit.timeWindow.end}` 
      : undefined
  };
}

export function applyCancelEdit(
  schedule: StaffSchedule[],
  edit: CancelEdit,
  clientList: Client[]
): { 
  newSchedule: StaffSchedule[]; 
  needsAdvisor: boolean;
  advisorProblem?: string;
  affectedStaff: string[];
} {
  const newSchedule: StaffSchedule[] = JSON.parse(JSON.stringify(schedule));
  const client = clientList.find(c => c.id === edit.clientId);
  
  if (!client) {
    return { newSchedule: schedule, needsAdvisor: false, affectedStaff: [] };
  }

  const affectedStaff: string[] = [];
  let cancelStartMinute = 0;
  let cancelEndMinute = 1440;
  
  if (edit.cancelType === "cancelled_until" && edit.time) {
    cancelEndMinute = parseTimeToMinutes(edit.time);
  } else if (edit.cancelType === "cancelled_at" && edit.time) {
    cancelStartMinute = parseTimeToMinutes(edit.time);
  }

  for (const staffSched of newSchedule) {
    const slotsToRemove: number[] = [];
    
    staffSched.slots.forEach((slot, idx) => {
      if (slot.clientId === edit.clientId) {
        const slotStart = slot.startMinute || 0;
        const slotEnd = slot.endMinute || 1440;
        
        if (slotStart < cancelEndMinute && slotEnd > cancelStartMinute) {
          slotsToRemove.push(idx);
          if (!affectedStaff.includes(staffSched.staffId)) {
            affectedStaff.push(staffSched.staffId);
          }
        }
      }
    });
    
    for (let i = slotsToRemove.length - 1; i >= 0; i--) {
      staffSched.slots[slotsToRemove[i]] = {
        ...staffSched.slots[slotsToRemove[i]],
        source: "CANCEL",
        value: "OPEN",
        clientId: undefined,
        reason: `Client ${client.name} cancelled`
      };
    }
  }

  return { 
    newSchedule, 
    needsAdvisor: affectedStaff.length > 0,
    advisorProblem: affectedStaff.length > 0 
      ? `${affectedStaff.length} staff member(s) need reassignment after ${client.name} cancellation`
      : undefined,
    affectedStaff
  };
}

export function applyTagEdit(
  schedule: StaffSchedule[],
  edit: TagEdit,
  staffList: Staff[]
): { newSchedule: StaffSchedule[]; needsAdvisor: boolean } {
  const newSchedule: StaffSchedule[] = JSON.parse(JSON.stringify(schedule));
  const startMinute = parseTimeToMinutes(edit.timeWindow.start);
  const endMinute = parseTimeToMinutes(edit.timeWindow.end);
  
  const staff = staffList.find(s => s.id === edit.staffId);
  if (!staff) {
    return { newSchedule: schedule, needsAdvisor: false };
  }

  let targetStaffSched = newSchedule.find(s => s.staffId === edit.staffId);
  if (!targetStaffSched) {
    const newStaffSched: StaffSchedule = {
      staffId: edit.staffId,
      status: "ACTIVE",
      slots: []
    };
    newSchedule.push(newStaffSched);
    targetStaffSched = newStaffSched;
  }

  const newSlot: ScheduleSlot = {
    id: `tag-${edit.staffId}-${startMinute}`,
    block: startMinute < 720 ? "AM" : "PM",
    value: edit.tagText,
    source: "REPAIR",
    reason: "Custom tag",
    startMinute,
    endMinute,
    indicator: "Tag"
  };

  targetStaffSched.slots.push(newSlot);

  return { newSchedule, needsAdvisor: false };
}

export function generateEditDescription(edit: ScheduleEdit, staffList: Staff[], clientList: Client[]): string {
  const getStaffName = (id: string) => staffList.find(s => s.id === id)?.name || "Unknown";
  const getClientName = (id: string) => clientList.find(c => c.id === id)?.name || "Unknown";
  
  switch (edit.type) {
    case "change_staff":
      return `Changed ${getClientName(edit.clientId)} to ${getStaffName(edit.staffId)} (${edit.timeWindow.start}-${edit.timeWindow.end})`;
    case "split":
      return `Split ${getStaffName(edit.staffId)}'s schedule into ${edit.segments.length} segments`;
    case "train":
      return `Added training: ${getStaffName(edit.traineeId)} with ${getClientName(edit.clientId)} (${edit.phase})`;
    case "cancel":
      return `Cancelled ${getClientName(edit.clientId)} (${edit.cancelType.replace("_", " ")})`;
    case "tag":
      return `Added tag "${edit.tagText}" to ${getStaffName(edit.staffId)}`;
    default:
      return "Unknown edit";
  }
}
