/**
 * Time Utilities Module
 * 
 * Consolidated time parsing and conversion utilities for the scheduling engine.
 * This module provides a single source of truth for converting between time strings
 * and minute values, eliminating duplicate parsing logic throughout the codebase.
 */

/**
 * Converts a time string (HH:MM format) to minutes from midnight.
 * Uses raw 24-hour parsing without PM adjustment.
 * 
 * @param timeStr - Time string in "HH:MM" or "H:MM" format (e.g., "11:30", "7:00")
 * @returns Minutes from midnight (e.g., "11:30" → 690, "12:00" → 720)
 * 
 * @example
 * timeStringToMinutes("7:30")   // 450
 * timeStringToMinutes("11:30")  // 690
 * timeStringToMinutes("12:00")  // 720
 * timeStringToMinutes("16:30")  // 990
 */
export function timeStringToMinutes(timeStr: string): number {
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + (mins || 0);
}

/**
 * Converts a time string to minutes with clinic schedule context.
 * Assumes times 1:00-6:00 are PM (adds 12 hours).
 * Use this for schedule blocks like "8:30-11:30" or "12:30-4:00".
 * 
 * @param timeStr - Time string in "H:MM" format
 * @returns Minutes from midnight with PM adjustment for hours 1-6
 * 
 * @example
 * timeStringToMinutesWithPmContext("8:00")   // 480 (8:00 AM)
 * timeStringToMinutesWithPmContext("4:00")   // 960 (4:00 PM)
 * timeStringToMinutesWithPmContext("12:30")  // 750 (12:30 PM)
 */
export function timeStringToMinutesWithPmContext(timeStr: string): number {
  const [hourStr, minStr] = timeStr.split(':');
  let hours = parseInt(hourStr, 10);
  const mins = parseInt(minStr, 10) || 0;
  
  // For clinic schedule (7:00 AM - 6:00 PM):
  // - 7, 8, 9, 10, 11 are AM (no adjustment)
  // - 12 is noon (no adjustment)
  // - 1, 2, 3, 4, 5, 6 are PM (add 12)
  if (hours >= 1 && hours <= 6) {
    hours += 12;
  }
  
  return hours * 60 + mins;
}

/**
 * Converts minutes from midnight to a time string (HH:MM format).
 * 
 * @param minutes - Minutes from midnight (0-1439)
 * @returns Time string in "H:MM" format with AM/PM suffix, or 24-hour format
 * 
 * @example
 * minutesToTimeString(450)  // "7:30"
 * minutesToTimeString(690)  // "11:30"
 * minutesToTimeString(720)  // "12:00"
 * minutesToTimeString(990)  // "16:30"
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Converts minutes from midnight to a 12-hour display format with AM/PM.
 * 
 * @param minutes - Minutes from midnight (0-1439)
 * @returns Time string in "H:MM AM/PM" format
 * 
 * @example
 * minutesToDisplayTime(450)   // "7:30 AM"
 * minutesToDisplayTime(690)   // "11:30 AM"
 * minutesToDisplayTime(720)   // "12:00 PM"
 * minutesToDisplayTime(990)   // "4:30 PM"
 */
export function minutesToDisplayTime(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
}

/**
 * Common time constants used throughout the scheduling system.
 * All values are in minutes from midnight.
 */
export const TIME_CONSTANTS = {
  AM_BLOCK_START: 450,    // 7:30 AM
  AM_BLOCK_END: 690,      // 11:30 AM
  PM_BLOCK_START: 750,    // 12:30 PM
  PM_BLOCK_END: 990,      // 4:30 PM
  
  LUNCH_FIRST_SLOT: 660,  // 11:00 AM
  LUNCH_SECOND_SLOT: 690, // 11:30 AM
  LUNCH_THIRD_SLOT: 720,  // 12:00 PM
  LUNCH_FOURTH_SLOT: 750, // 12:30 PM
  
  LUNCH_SLOT_DURATION: 30, // 30 minutes per lunch slot
  
  TIMELINE_START: 420,    // 7:00 AM
  TIMELINE_END: 1050,     // 5:30 PM
  
  ONE_PM: 780,            // 1:00 PM - threshold for late lunch blocking
} as const;

/**
 * Canonical lunch time labels used throughout the system.
 */
export type LunchTimeLabel = "11:00" | "11:30" | "12:00" | "12:30";

/**
 * Maps a minute value to the closest canonical lunch slot label.
 * 
 * @param startMinute - Start minute of the lunch slot
 * @returns The closest canonical lunch time label
 */
export function getCanonicalLunchLabel(startMinute: number): LunchTimeLabel {
  if (startMinute < 675) return "11:00";      // Before 11:15
  if (startMinute < 705) return "11:30";      // 11:15 - 11:45
  if (startMinute < 735) return "12:00";      // 11:45 - 12:15
  return "12:30";                              // 12:15 and later
}

/**
 * Checks if two time ranges overlap.
 * 
 * @param start1 - Start minute of first range
 * @param end1 - End minute of first range
 * @param start2 - Start minute of second range
 * @param end2 - End minute of second range
 * @returns True if the ranges overlap
 */
export function timeRangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Parses a time window object with start/end strings to minute values.
 * Uses raw 24-hour parsing.
 * 
 * @param timeWindow - Object with start and end time strings
 * @returns Object with startMinute and endMinute values
 */
export function parseTimeWindow(timeWindow: { start: string; end: string }): {
  startMinute: number;
  endMinute: number;
} {
  return {
    startMinute: timeStringToMinutes(timeWindow.start),
    endMinute: timeStringToMinutes(timeWindow.end),
  };
}

/**
 * Parses a block string like "8:30-11:30" into { startMinute, endMinute }.
 * Uses PM context for schedule blocks.
 * 
 * @param block - Block string in "H:MM-H:MM" format
 * @returns Object with startMinute and endMinute values
 * 
 * @example
 * parseBlockToMinutes("8:30-11:30")  // { startMinute: 510, endMinute: 690 }
 * parseBlockToMinutes("12:30-4:00")  // { startMinute: 750, endMinute: 960 }
 */
export function parseBlockToMinutes(block: string): {
  startMinute: number;
  endMinute: number;
} {
  const [startStr, endStr] = block.split('-').map(s => s.trim());
  return {
    startMinute: timeStringToMinutesWithPmContext(startStr),
    endMinute: timeStringToMinutesWithPmContext(endStr),
  };
}
