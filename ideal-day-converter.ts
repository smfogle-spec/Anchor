import type { IdealDaySegment } from "@shared/schema";
import type { WeeklyTemplate, WeekDay, LocalTemplateAssignment } from "./types";

const AM_START = 420; // 7:00 AM
const AM_END = 690;   // 11:30 AM
const PM_START = 750; // 12:30 PM
const PM_END = 1020;  // 5:00 PM

export function buildTemplateFromIdealDay(
  segments: IdealDaySegment[],
  weekDay: WeekDay
): WeeklyTemplate {
  const template: WeeklyTemplate = {
    mon: { am: [], pm: [] },
    tue: { am: [], pm: [] },
    wed: { am: [], pm: [] },
    thu: { am: [], pm: [] },
    fri: { am: [], pm: [] },
  };

  // Filter to only client segments (the engine handles scheduling client assignments)
  const clientSegments = segments.filter(s => s.segmentType === "client" && s.clientId);

  // Group segments by staffId
  const segmentsByStaff = new Map<string, IdealDaySegment[]>();
  clientSegments.forEach(seg => {
    if (!segmentsByStaff.has(seg.staffId)) {
      segmentsByStaff.set(seg.staffId, []);
    }
    segmentsByStaff.get(seg.staffId)!.push(seg);
  });

  // Process each staff's segments
  segmentsByStaff.forEach((staffSegments, staffId) => {
    // Sort by start time
    const sorted = [...staffSegments].sort((a, b) => a.startMinute - b.startMinute);

    // Separate into AM and PM blocks based on segment timing
    const amSegments = sorted.filter(s => s.startMinute < AM_END && s.endMinute <= AM_END + 60);
    const pmSegments = sorted.filter(s => s.startMinute >= PM_START - 30);

    // Process AM block
    if (amSegments.length > 0) {
      const amAssignment = createAssignmentFromSegments(staffId, amSegments, "am");
      if (amAssignment) {
        template[weekDay].am.push(amAssignment);
      }
    }

    // Process PM block
    if (pmSegments.length > 0) {
      const pmAssignment = createAssignmentFromSegments(staffId, pmSegments, "pm");
      if (pmAssignment) {
        template[weekDay].pm.push(pmAssignment);
      }
    }
  });

  return template;
}

function createAssignmentFromSegments(
  staffId: string,
  segments: IdealDaySegment[],
  block: "am" | "pm"
): LocalTemplateAssignment | null {
  if (segments.length === 0) return null;

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.startMinute - b.startMinute);

  if (sorted.length === 1) {
    // Single segment - simple assignment
    const seg = sorted[0];
    return {
      staffId,
      clientId: seg.clientId,
      locationId: seg.locationId ?? undefined,
      startMinute: seg.startMinute,
      endMinute: seg.endMinute,
    };
  }

  // Multiple segments - create split assignment
  const allSegments = sorted.map(seg => ({
    clientId: seg.clientId,
    locationId: seg.locationId ?? null,
    startMinute: seg.startMinute,
    endMinute: seg.endMinute,
  }));

  // Primary client is from the first segment
  const primary = sorted[0];
  
  return {
    staffId,
    clientId: primary.clientId,
    locationId: primary.locationId ?? undefined,
    startMinute: allSegments[0].startMinute,
    endMinute: allSegments[allSegments.length - 1].endMinute,
    segments: allSegments,
  };
}

function deepCloneAssignment(a: LocalTemplateAssignment): LocalTemplateAssignment {
  return {
    ...a,
    segments: a.segments ? a.segments.map(s => ({ ...s })) : undefined,
  };
}

function deepCloneDayTemplate(day: { am: LocalTemplateAssignment[]; pm: LocalTemplateAssignment[] }): { am: LocalTemplateAssignment[]; pm: LocalTemplateAssignment[] } {
  return {
    am: day.am.map(deepCloneAssignment),
    pm: day.pm.map(deepCloneAssignment),
  };
}

export function mergeIdealDayWithFallback(
  idealDaySegments: IdealDaySegment[] | null,
  fallbackTemplate: WeeklyTemplate,
  weekDay: WeekDay
): WeeklyTemplate {
  // If no ideal day segments exist, fall back to template assignments (deep cloned to prevent mutation)
  if (!idealDaySegments || idealDaySegments.length === 0) {
    return {
      mon: deepCloneDayTemplate(fallbackTemplate.mon),
      tue: deepCloneDayTemplate(fallbackTemplate.tue),
      wed: deepCloneDayTemplate(fallbackTemplate.wed),
      thu: deepCloneDayTemplate(fallbackTemplate.thu),
      fri: deepCloneDayTemplate(fallbackTemplate.fri),
    };
  }

  // Build template from ideal day for this specific day
  const idealTemplate = buildTemplateFromIdealDay(idealDaySegments, weekDay);

  // Deep clone both templates to prevent mutation during lunch coverage processing
  // Return a merged template where this day uses ideal day, others use fallback
  return {
    mon: weekDay === 'mon' ? deepCloneDayTemplate(idealTemplate.mon) : deepCloneDayTemplate(fallbackTemplate.mon),
    tue: weekDay === 'tue' ? deepCloneDayTemplate(idealTemplate.tue) : deepCloneDayTemplate(fallbackTemplate.tue),
    wed: weekDay === 'wed' ? deepCloneDayTemplate(idealTemplate.wed) : deepCloneDayTemplate(fallbackTemplate.wed),
    thu: weekDay === 'thu' ? deepCloneDayTemplate(idealTemplate.thu) : deepCloneDayTemplate(fallbackTemplate.thu),
    fri: weekDay === 'fri' ? deepCloneDayTemplate(idealTemplate.fri) : deepCloneDayTemplate(fallbackTemplate.fri),
  };
}
