import { useMemo, useRef } from "react";
import { generateDailySchedule, type ScheduleEngineResult, type SchedulerTrainingSession, type ApprovedSub } from "@/lib/schedule-engine";
import { scheduleCache } from "@/lib/schedule-cache";
import { trackPerformance } from "@/lib/performance-metrics";
import { logDecision } from "@/lib/decision-logger";
import type { Exception } from "@/lib/daily-run-data";
import type { Staff, Client, TemplateAssignment, ClientLocation, School, ClientCancelLink } from "@shared/schema";

interface ScheduleData {
  staff: Staff[];
  clients: Client[];
  templateAssignments: TemplateAssignment[];
  clientLocations?: ClientLocation[];
  schools?: School[];
  cancelLinks?: ClientCancelLink[];
  trainingSessions?: SchedulerTrainingSession[];
}

export function useCachedSchedule(
  exceptions: Exception[],
  data: ScheduleData | undefined,
  approvedSubs: ApprovedSub[] = [],
  dayOfWeek?: number
): ScheduleEngineResult {
  const lastResultRef = useRef<ScheduleEngineResult | null>(null);
  
  const result = useMemo(() => {
    if (!data || data.staff.length === 0) {
      return { 
        schedule: [], 
        pendingSubApprovals: [], 
        changes: [], 
        lunchCoverageErrors: [], 
        trainingSessionUpdates: [] 
      };
    }

    const effectiveDayOfWeek = dayOfWeek ?? new Date().getDay();
    
    const cached = scheduleCache.get(exceptions, data, approvedSubs, effectiveDayOfWeek);
    if (cached) {
      logDecision("staff_assignment", "Schedule loaded from cache", {
        staffCount: data.staff.length,
        clientCount: data.clients.length,
        cacheHit: true,
      });
      return cached as ScheduleEngineResult;
    }

    const engineResult = trackPerformance(
      "generateDailySchedule",
      () => generateDailySchedule(exceptions, data, approvedSubs, effectiveDayOfWeek),
      { 
        staffCount: data.staff.length, 
        clientCount: data.clients.length,
        exceptionCount: exceptions.length,
      }
    );

    scheduleCache.set(exceptions, data, approvedSubs, effectiveDayOfWeek, engineResult);

    logDecision("staff_assignment", "Schedule generated", {
      staffCount: data.staff.length,
      clientCount: data.clients.length,
      scheduleRows: engineResult.schedule.length,
      pendingApprovals: engineResult.pendingSubApprovals.length,
      lunchErrors: engineResult.lunchCoverageErrors.length,
    });

    lastResultRef.current = engineResult;
    return engineResult;
  }, [exceptions, data, approvedSubs, dayOfWeek]);

  return result;
}

export function usePreviousSchedule(): ScheduleEngineResult | null {
  const resultRef = useRef<ScheduleEngineResult | null>(null);
  return resultRef.current;
}
