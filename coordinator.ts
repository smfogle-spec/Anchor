import { type Exception, type ApprovalRequest, type CancelTiming } from "../daily-run-data";
import { type StaffSchedule, type SourceTag, type ScheduleSegment, TIME_BLOCKS, parseBlockToMinutes, formatMinutesToTime } from "../schedule-data";
import type { Staff, Client, TemplateAssignment, ClientLocation, School, ClientCancelLink, IdealDaySegment } from "@shared/schema";
import type { WeeklyTemplate, WeekDay, TemplateAssignment as LocalTemplateAssignment } from "../template-data";

import { buildTemplateFromAssignments, getEligibleStaff, getSortedStaff } from "./coverage-module";
import { mergeIdealDayWithFallback } from "./ideal-day-converter";
import { assignLunchGroups, buildLunchCoverage } from "./lunch-module";
import { buildCancelPool, selectCancelTarget, determineCancelTiming, getCancelTimingDescription } from "./cancellations-module";
import { isNewHireProtected } from "./training-module";

import type {
  SchedulerTrainingSession,
  TrainingSessionUpdate,
  ScheduleChangeEntry,
  LunchTime,
  LunchCoverageError,
  ScheduleEngineResult,
  ApprovedSub,
  LunchGroup,
  UncoveredGap,
} from "./types";

export type { ScheduleEngineResult, LunchCoverageError, ScheduleChangeEntry, TrainingSessionUpdate, SchedulerTrainingSession };

interface ScheduleEngineData {
  staff: Staff[];
  clients: Client[];
  templateAssignments: TemplateAssignment[];
  idealDaySegments?: IdealDaySegment[];
  clientLocations?: ClientLocation[];
  schools?: School[];
  cancelLinks?: ClientCancelLink[];
  trainingSessions?: SchedulerTrainingSession[];
}

export function getWeekdayIndex(dateInput: Date | string): number {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.getDay();
}

export function getDayKeyFromIndex(dayOfWeek: number): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | null {
  const dayKeys: ('mon' | 'tue' | 'wed' | 'thu' | 'fri')[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  if (dayOfWeek < 1 || dayOfWeek > 5) return null;
  return dayKeys[dayOfWeek - 1];
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function generateDailySchedule(
  exceptions: Exception[],
  data?: ScheduleEngineData,
  approvedSubs: ApprovedSub[] = [],
  dayOfWeek?: number
): ScheduleEngineResult {
  if (!data || data.staff.length === 0) {
    return { schedule: [], pendingSubApprovals: [], changes: [], lunchCoverageErrors: [], trainingSessionUpdates: [] };
  }
  
  const pendingSubApprovals: ApprovalRequest[] = [];
  const { staff: allStaff, clients: allClients, templateAssignments, idealDaySegments = [], clientLocations = [], schools = [], cancelLinks = [], trainingSessions = [] } = data;
  
  const uncoveredGaps: UncoveredGap[] = [];
  const trainingSessionUpdates: TrainingSessionUpdate[] = [];
  
  const checkNewHireProtected = (staffId: string): boolean => {
    return isNewHireProtected(staffId, allStaff);
  };
  
  const getSchoolLunchWindow = (locationId: string | null | undefined): { startMinute: number; endMinute: number } | null => {
    if (!locationId) return null;
    const location = clientLocations.find(l => l.id === locationId);
    if (!location || location.locationType !== 'school' || !location.schoolId) return null;
    const school = schools.find(s => s.id === location.schoolId);
    if (!school || !school.hasAlternativeLunch) return null;
    return {
      startMinute: school.lunchWindowStartMinute,
      endMinute: school.lunchWindowEndMinute
    };
  };
  
  const getClientCancelProtection = (clientId: string): { isProtected: boolean; protectedLocations: { locationType: string; exemptUntilDate: string }[] } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const clientLocs = clientLocations.filter(loc => loc.clientId === clientId);
    const protectedLocations: { locationType: string; exemptUntilDate: string }[] = [];
    
    for (const loc of clientLocs) {
      if (!loc.serviceStartDate) continue;
      const startDate = parseLocalDate(loc.serviceStartDate);
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceStart < 30) {
        const exemptUntil = new Date(startDate);
        exemptUntil.setDate(exemptUntil.getDate() + 30);
        protectedLocations.push({
          locationType: loc.displayName || loc.locationType,
          exemptUntilDate: `${exemptUntil.getMonth() + 1}/${exemptUntil.getDate()}/${exemptUntil.getFullYear()}`
        });
      }
    }
    
    return { 
      isProtected: protectedLocations.length > 0, 
      protectedLocations 
    };
  };
  
  const eligibleStaff = getEligibleStaff(allStaff);
  const sortedStaff = getSortedStaff(eligibleStaff);
  
  const scheduleDayOfWeek = dayOfWeek ?? new Date().getDay();
  const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  let dayKey = dayMap[scheduleDayOfWeek];
  
  if (dayKey === "sun" || dayKey === "sat") {
    dayKey = "mon"; 
  }

  // Build template: start from template assignments, then merge ideal day segments for the current day
  const fallbackTemplate = buildTemplateFromAssignments(templateAssignments);
  const template = mergeIdealDayWithFallback(idealDaySegments, fallbackTemplate, dayKey as WeekDay);

  const defaultDayTemplate = { am: [] as LocalTemplateAssignment[], pm: [] as LocalTemplateAssignment[] };
  const templateDay = template[dayKey as WeekDay] || defaultDayTemplate;
  
  const unavailableClients = new Set(
    exceptions
      .filter(e => e.type === "client" && ((e.mode === "out" && e.allDay) || e.mode === "cancelled"))
      .map(e => e.entityId)
  );

  const outStaffIds = new Set(
    exceptions
      .filter(e => e.type === "staff" && e.mode === "out")
      .map(e => e.entityId)
  );
  
  const todayTrainingSessions = trainingSessions.filter(ts => 
    ts.status === 'planned' && 
    (ts.planStatus === 'active' || ts.planStatus === null) &&
    ts.scheduledBlock !== null
  );
  
  todayTrainingSessions.forEach(session => {
    const traineeId = session.traineeId;
    const clientId = session.clientId;
    const trainerId = session.trainerId || session.preferredTrainerId;
    
    if (traineeId && outStaffIds.has(traineeId)) {
      trainingSessionUpdates.push({
        sessionId: session.id,
        newStatus: 'blocked',
        reason: 'Trainee is unavailable (marked OUT)'
      });
      return;
    }
    
    if (clientId && unavailableClients.has(clientId)) {
      trainingSessionUpdates.push({
        sessionId: session.id,
        newStatus: 'blocked',
        reason: 'Training client is unavailable'
      });
      return;
    }
    
    if (trainerId && outStaffIds.has(trainerId)) {
      trainingSessionUpdates.push({
        sessionId: session.id,
        newStatus: 'disrupted',
        reason: 'Assigned trainer is unavailable'
      });
    }
  });

  const activeStaffIds = sortedStaff
    .filter(s => s.active && !outStaffIds.has(s.id))
    .map(s => s.id);

  const lunchGroups = assignLunchGroups(activeStaffIds, templateDay.am, templateDay.pm, allStaff, allClients, dayKey, unavailableClients, schools, clientLocations);

  const { 
    slot1100Coverage, 
    slot1130Coverage, 
    slot1200Coverage, 
    slot1230Coverage, 
    errors: lunchErrors,
    updatedLunchGroups 
  } = buildLunchCoverage(
    lunchGroups,
    templateDay.am,
    templateDay.pm,
    allClients,
    allStaff,
    unavailableClients,
    dayKey
  );

  const getLunchTime = (staffId: string): LunchTime | undefined => {
    return updatedLunchGroups.staffLunchTimes.get(staffId);
  };

  const bcbaPrepStaffBlocks = new Map<string, { am: boolean; pm: boolean }>();
  sortedStaff.forEach(s => {
    if (s.role === 'Lead RBT' && s.leadLevel === 3 && s.bcbaPrepEnabled) {
      const bcbaPrepSchedule = s.bcbaPrepSchedule as Record<string, { am: boolean; pm: boolean }> | null;
      const scheduleDayKeyStr = dayKey as 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
      if (bcbaPrepSchedule?.[scheduleDayKeyStr]) {
        bcbaPrepStaffBlocks.set(s.id, bcbaPrepSchedule[scheduleDayKeyStr]);
      }
    }
  });

  let schedule = sortedStaff.map(staffMember => {
    const staffException = exceptions.find(e => e.type === "staff" && e.entityId === staffMember.id && e.mode === "out");
    const isStaffOut = !!staffException;

    const amAssignment = templateDay.am.find(a => a.staffId === staffMember.id);
    const pmAssignment = templateDay.pm.find(a => a.staffId === staffMember.id);
    const staffLunchTime = getLunchTime(staffMember.id);
    
    const bcbaPrepDay = bcbaPrepStaffBlocks.get(staffMember.id);

    const slots = TIME_BLOCKS.map((block, index) => {
      let value = "OPEN";
      let source: any = "UNFILLED";
      let reason = "Unassigned";
      let clientId: string | undefined = undefined;
      let location: string | undefined = undefined;
      
      const isAmBlock = index === 0 || index === 1;
      const isPmBlock = index === 4 || index === 5;
      
      if (bcbaPrepDay && !isStaffOut) {
        const hasBcbaPrepAm = bcbaPrepDay.am && isAmBlock;
        const hasBcbaPrepPm = bcbaPrepDay.pm && isPmBlock;
        const hasClientAssignment = isAmBlock ? (amAssignment?.clientId && !unavailableClients.has(amAssignment.clientId)) : 
                                    isPmBlock ? (pmAssignment?.clientId && !unavailableClients.has(pmAssignment.clientId)) : false;
        
        if ((hasBcbaPrepAm || hasBcbaPrepPm) && !hasClientAssignment) {
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "BCBA Prep",
            source: "OFF_SCHEDULE" as SourceTag,
            reason: "BCBA Preparation (Protected)",
            clientId: undefined,
            location: undefined,
            indicator: "BCBA Prep"
          };
        }
      }

      if (index === 1) {
        if (isStaffOut) {
          if (amAssignment?.clientId && !unavailableClients.has(amAssignment.clientId)) {
            const client = allClients.find(c => c.id === amAssignment.clientId);
            return {
              id: `${staffMember.id}-${index}`,
              block,
              value: "UNFILLED",
              source: "UNFILLED",
              reason: "Staff Out - needs coverage",
              clientId: amAssignment.clientId,
              location: client?.defaultLocation
            };
          }
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "OUT",
            source: "CANCEL",
            reason: "Staff Out",
            clientId: undefined,
            location: undefined
          };
        }
        
        if (staffLunchTime === "11:00") {
          // Early lunch uses segments to split the AM block
          const amClient = allClients.find(c => c.id === amAssignment?.clientId);
          // Use assignment's actual start time if available
          const amStartMinute = amAssignment?.startMinute ?? 510;
          const amEndMinute = amAssignment?.endMinute ?? 660;
          const segments: ScheduleSegment[] = [];
          
          if (amClient) {
            segments.push({
              id: `${staffMember.id}-${index}-work`,
              block: `${formatMinutesToTime(amStartMinute)}-${formatMinutesToTime(Math.min(amEndMinute, 660))}`,
              value: amClient.name,
              source: "TEMPLATE" as SourceTag,
              reason: "AM Assignment",
              clientId: amAssignment?.clientId || undefined,
              location: amClient?.defaultLocation || undefined,
              startMinute: amStartMinute,
              endMinute: Math.min(amEndMinute, 660)
            });
          }
          segments.push({
            id: `${staffMember.id}-${index}-lunch`,
            block: "11:00-11:30",
            value: "LUNCH",
            source: "TEMPLATE" as SourceTag,
            reason: "Early Lunch (11:00)",
            clientId: undefined,
            location: undefined,
            startMinute: 660,
            endMinute: 690
          });
          
          const computedBlock = `${formatMinutesToTime(amStartMinute)}-${formatMinutesToTime(690)}`;
          return {
            id: `${staffMember.id}-${index}`,
            block: computedBlock,
            value: amClient ? amClient.name : "LUNCH",
            source: "TEMPLATE" as SourceTag,
            reason: "Early Lunch (11:00)",
            clientId: amAssignment?.clientId || undefined,
            location: amClient?.defaultLocation || undefined,
            startMinute: amStartMinute,
            endMinute: 690,
            segments
          };
        }
        
        const coverage = slot1100Coverage.get(staffMember.id);
        if (coverage && coverage.clientNames.length > 0) {
          const displayValue = coverage.clientNames.join("/");
          const coverageReason = coverage.clientNames.length > 1 
            ? `Lunch Coverage (${coverage.clientNames.length} clients)` 
            : "Lunch Coverage";
          const coverageClient = allClients.find(c => c.id === coverage.clientIds[0]);
          // Use assignment times if available for coverage slots too
          const slotStartMinute = amAssignment?.startMinute ?? 690; // 11:30 default for coverage
          return {
            id: `${staffMember.id}-${index}`,
            block: `${formatMinutesToTime(slotStartMinute)}-${formatMinutesToTime(720)}`,
            value: displayValue,
            source: "TEMPLATE",
            reason: coverageReason,
            clientId: coverage.clientIds[0],
            location: coverageClient?.defaultLocation,
            startMinute: slotStartMinute,
            endMinute: 720
          };
        }
        
        if (amAssignment && amAssignment.clientId) {
          if (unavailableClients.has(amAssignment.clientId)) {
            return {
              id: `${staffMember.id}-${index}`,
              block,
              value: "UNFILLED",
              source: "UNFILLED",
              reason: "Client unavailable",
              clientId: undefined,
              location: undefined
            };
          } else {
            const client = allClients.find(c => c.id === amAssignment.clientId);
            // Use assignment's startMinute/endMinute if available, otherwise fall back to defaults
            const slotStartMinute = amAssignment.startMinute ?? 510; // 8:30 AM default
            const slotEndMinute = amAssignment.endMinute ?? 690; // 11:30 AM default
            // Compute block string from minutes for accurate display
            const computedBlock = `${formatMinutesToTime(slotStartMinute)}-${formatMinutesToTime(slotEndMinute)}`;
            return {
              id: `${staffMember.id}-${index}`,
              block: computedBlock,
              value: client ? client.name : "Unknown",
              source: "TEMPLATE",
              reason: "Matched from Template",
              clientId: amAssignment.clientId,
              location: client?.defaultLocation,
              startMinute: slotStartMinute,
              endMinute: slotEndMinute
            };
          }
        }
        
        return {
          id: `${staffMember.id}-${index}`,
          block,
          value: "OPEN",
          source: "UNFILLED",
          reason: "Unassigned",
          clientId: undefined,
          location: undefined
        };
      }

      if (index === 2) {
        if (isStaffOut) {
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "OUT",
            source: "CANCEL",
            reason: "Staff Out",
            clientId: undefined,
            location: undefined
          };
        }
        
        if (staffLunchTime === "11:30") {
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "LUNCH",
            source: "TEMPLATE",
            reason: "Lunch (11:30)",
            clientId: undefined,
            location: undefined
          };
        }
        
        const coverage1130 = slot1130Coverage.get(staffMember.id);
        if (coverage1130 && coverage1130.clientNames.length > 0) {
          const displayValue = coverage1130.clientNames.join("/");
          const coverageReason = coverage1130.clientNames.length > 1 
            ? `Lunch Coverage (${coverage1130.clientNames.length} clients)` 
            : (staffLunchTime === "11:00" ? "Self Coverage (Early Lunch)" : "Lunch Coverage");
          const coverageClient = allClients.find(c => c.id === coverage1130.clientIds[0]);
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: displayValue,
            source: "TEMPLATE",
            reason: coverageReason,
            clientId: coverage1130.clientIds[0],
            location: coverageClient?.defaultLocation
          };
        }
        
        return {
          id: `${staffMember.id}-${index}`,
          block,
          value: "LUNCH",
          source: "TEMPLATE",
          reason: "No coverage needed",
          clientId: undefined,
          location: undefined
        };
      }

      if (index === 3) {
        if (isStaffOut) {
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "OUT",
            source: "CANCEL",
            reason: "Staff Out",
            clientId: undefined,
            location: undefined
          };
        }
        
        if (staffLunchTime === "12:00") {
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "LUNCH",
            source: "TEMPLATE",
            reason: "Lunch (12:00)",
            clientId: undefined,
            location: undefined
          };
        }
        
        const coverage1200 = slot1200Coverage.get(staffMember.id);
        if (coverage1200 && coverage1200.clientNames.length > 0) {
          const displayValue = coverage1200.clientNames.join("/");
          const coverageReason = coverage1200.clientNames.length > 1 
            ? `Lunch Coverage (${coverage1200.clientNames.length} clients)` 
            : (staffLunchTime === "12:30" ? "Self Coverage (Late Lunch)" : "Lunch Coverage");
          const coverageClient = allClients.find(c => c.id === coverage1200.clientIds[0]);
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: displayValue,
            source: "TEMPLATE",
            reason: coverageReason,
            clientId: coverage1200.clientIds[0],
            location: coverageClient?.defaultLocation
          };
        }
        
        return {
          id: `${staffMember.id}-${index}`,
          block,
          value: "LUNCH",
          source: "TEMPLATE",
          reason: "No coverage needed",
          clientId: undefined,
          location: undefined
        };
      }

      if (index === 4) {
        if (isStaffOut) {
          if (pmAssignment?.clientId && !unavailableClients.has(pmAssignment.clientId)) {
            const client = allClients.find(c => c.id === pmAssignment.clientId);
            return {
              id: `${staffMember.id}-${index}`,
              block,
              value: "UNFILLED",
              source: "UNFILLED",
              reason: "Staff Out - needs coverage",
              clientId: pmAssignment.clientId,
              location: client?.defaultLocation
            };
          }
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "OUT",
            source: "CANCEL",
            reason: "Staff Out",
            clientId: undefined,
            location: undefined
          };
        }
        
        if (staffLunchTime === "12:30") {
          const pmClient = allClients.find(c => c.id === pmAssignment?.clientId);
          const segments: ScheduleSegment[] = [
            {
              id: `${staffMember.id}-${index}-lunch`,
              block: "12:30-1:00",
              value: "LUNCH",
              source: "TEMPLATE" as SourceTag,
              reason: "Late Lunch (12:30)",
              clientId: undefined,
              location: undefined,
              startMinute: 750,
              endMinute: 780
            }
          ];
          if (pmClient) {
            segments.push({
              id: `${staffMember.id}-${index}-work`,
              block: "1:00-4:00",
              value: pmClient.name,
              source: "TEMPLATE" as SourceTag,
              reason: "PM Assignment",
              clientId: pmAssignment?.clientId || undefined,
              location: pmClient.defaultLocation || undefined,
              startMinute: 780,
              endMinute: 960
            });
          }
          return {
            id: `${staffMember.id}-${index}`,
            block,
            value: "LUNCH",
            source: "TEMPLATE" as SourceTag,
            reason: "Late Lunch (12:30)",
            clientId: pmAssignment?.clientId || undefined,
            location: pmClient?.defaultLocation || undefined,
            startMinute: 750,
            endMinute: 960,
            segments
          };
        }
        
        const coverage1230 = slot1230Coverage.get(staffMember.id);
        if (coverage1230 && coverage1230.clientNames.length > 0) {
          const pmClient = allClients.find(c => c.id === pmAssignment?.clientId);
          const coverageClient = allClients.find(c => c.id === coverage1230.clientIds[0]);
          const coverageNames = coverage1230.clientNames.join("/");
          
          if (pmClient) {
            const segments: ScheduleSegment[] = [
              {
                id: `${staffMember.id}-${index}-coverage`,
                block: "12:30-1:00",
                value: coverageNames,
                source: "TEMPLATE" as SourceTag,
                reason: `Lunch Coverage (${coverage1230.clientNames.length} client${coverage1230.clientNames.length > 1 ? 's' : ''})`,
                clientId: coverage1230.clientIds[0] || undefined,
                location: coverageClient?.defaultLocation,
                startMinute: 750,
                endMinute: 780
              },
              {
                id: `${staffMember.id}-${index}-work`,
                block: "1:00-4:00",
                value: pmClient.name,
                source: "TEMPLATE" as SourceTag,
                reason: "PM Assignment",
                clientId: pmAssignment?.clientId || undefined,
                location: pmClient.defaultLocation || undefined,
                startMinute: 780,
                endMinute: 960
              }
            ];
            return {
              id: `${staffMember.id}-${index}`,
              block,
              value: pmClient.name,
              source: "TEMPLATE" as SourceTag,
              reason: "PM + Lunch Coverage",
              clientId: pmAssignment?.clientId || undefined,
              location: pmClient.defaultLocation || undefined,
              startMinute: 750,
              endMinute: 960,
              segments
            };
          } else {
            return {
              id: `${staffMember.id}-${index}`,
              block,
              value: coverageNames,
              source: "TEMPLATE" as SourceTag,
              reason: `Lunch Coverage Only (${coverage1230.clientNames.length} client${coverage1230.clientNames.length > 1 ? 's' : ''})`,
              clientId: coverage1230.clientIds[0] || undefined,
              location: coverageClient?.defaultLocation,
              startMinute: 750,
              endMinute: 780
            };
          }
        }
        
        if (pmAssignment && pmAssignment.clientId) {
          if (unavailableClients.has(pmAssignment.clientId)) {
            return {
              id: `${staffMember.id}-${index}`,
              block,
              value: "UNFILLED",
              source: "UNFILLED",
              reason: "Client unavailable",
              clientId: undefined,
              location: undefined
            };
          } else {
            const client = allClients.find(c => c.id === pmAssignment.clientId);
            // Use assignment's startMinute/endMinute if available, otherwise fall back to PM defaults
            const slotStartMinute = pmAssignment.startMinute ?? 750; // 12:30 PM default
            const slotEndMinute = pmAssignment.endMinute ?? 960; // 4:00 PM default
            // Compute block string from minutes for accurate display
            const computedBlock = `${formatMinutesToTime(slotStartMinute)}-${formatMinutesToTime(slotEndMinute)}`;
            return {
              id: `${staffMember.id}-${index}`,
              block: computedBlock,
              value: client ? client.name : "Unknown",
              source: "TEMPLATE",
              reason: "Matched from Template",
              clientId: pmAssignment.clientId,
              location: client?.defaultLocation,
              startMinute: slotStartMinute,
              endMinute: slotEndMinute
            };
          }
        }
        
        return {
          id: `${staffMember.id}-${index}`,
          block,
          value: "OPEN",
          source: "UNFILLED",
          reason: "Unassigned",
          clientId: undefined,
          location: undefined
        };
      }

      if (index === 0) {
        if (amAssignment && amAssignment.clientId) {
          if (unavailableClients.has(amAssignment.clientId)) {
            value = "UNFILLED";
            source = "UNFILLED";
            reason = "Client unavailable";
            clientId = undefined;
          } else {
            const client = allClients.find(c => c.id === amAssignment.clientId);
            clientId = amAssignment.clientId;
            value = client ? client.name : "Unknown"; 
            source = "TEMPLATE";
            reason = "Matched from Template";
            location = client?.defaultLocation;
          }
        }
      } else if (index === 5) {
        if (pmAssignment && pmAssignment.clientId) {
          if (unavailableClients.has(pmAssignment.clientId)) {
            value = "UNFILLED";
            source = "UNFILLED";
            reason = "Client unavailable";
            clientId = undefined;
          } else {
            const client = allClients.find(c => c.id === pmAssignment.clientId);
            clientId = pmAssignment.clientId;
            value = client ? client.name : "Unknown"; 
            source = "TEMPLATE";
            reason = "Matched from Template";
            location = client?.defaultLocation;
          }
        }
      }

      if (isStaffOut) {
        if (source === "TEMPLATE") {
          value = "UNFILLED";
          source = "UNFILLED"; 
          reason = `Staff ${staffMember.name} is OUT`;
          location = undefined;
        } else {
            value = "OUT";
            source = "CANCEL";
            reason = "Staff Out";
            clientId = undefined;
            location = undefined;
        }
      }

      return {
        id: `${staffMember.id}-${index}`,
        block,
        value,
        source,
        reason,
        clientId,
        location
      };
    });

    return {
      staffId: staffMember.id,
      status: (isStaffOut ? "OUT" : "ACTIVE") as "OUT" | "ACTIVE",
      slots
    };
  });

  const changes: ScheduleChangeEntry[] = [];
  const todayDate = new Date().toISOString().split('T')[0];

  return { schedule, pendingSubApprovals, changes, lunchCoverageErrors: lunchErrors, trainingSessionUpdates };
}
