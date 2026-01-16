import type { WeekDay } from "./types";

export function getWeekdayIndex(dateInput: Date | string): number {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.getDay();
}

export function getDayKeyFromIndex(dayOfWeek: number): WeekDay | null {
  const dayKeys: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  if (dayOfWeek < 1 || dayOfWeek > 5) return null;
  return dayKeys[dayOfWeek - 1];
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysSince(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = parseLocalDate(dateStr);
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function isWithin30Days(dateStr: string): boolean {
  return getDaysSince(dateStr) < 30;
}

export function getExemptDate(startDateStr: string, daysToAdd: number = 30): Date {
  const startDate = parseLocalDate(startDateStr);
  const exemptDate = new Date(startDate);
  exemptDate.setDate(exemptDate.getDate() + daysToAdd);
  return exemptDate;
}
