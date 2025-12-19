/**
 * Date/Timezone Utilities for Coverage Scheduling
 *
 * This module provides consistent date handling across the application.
 * The VMS operates in Eastern Time (America/New_York) but runs on Vercel (UTC).
 *
 * Key principles:
 * 1. Database stores dates as @db.Date (UTC midnight)
 * 2. All server-side date logic uses Eastern Time for "today" calculations
 * 3. Date strings (YYYY-MM-DD) are timezone-agnostic
 * 4. When comparing dates, compare string representations
 */

// Organization timezone - matches email.ts DEFAULT_TIMEZONE
export const ORG_TIMEZONE = 'America/New_York';

/**
 * Get today's date string (YYYY-MM-DD) in Eastern Time.
 * Use this for "today" comparisons in business logic.
 */
export function getTodayET(): string {
  const now = new Date();
  // toLocaleDateString with 'en-CA' locale returns YYYY-MM-DD format
  return now.toLocaleDateString('en-CA', { timeZone: ORG_TIMEZONE });
}

/**
 * Get current hour (0-23) in Eastern Time.
 * Use this for determining which time slots have already passed today.
 */
export function getCurrentHourET(): number {
  const now = new Date();
  const hourStr = now.toLocaleString('en-US', {
    timeZone: ORG_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(hourStr, 10);
}

/**
 * Get current date as a Date object at midnight UTC.
 * Use this when you need a Date object for database queries.
 */
export function getTodayDateUTC(): Date {
  const todayStr = getTodayET();
  return parseDateStringToUTC(todayStr);
}

/**
 * Parse a YYYY-MM-DD string to a Date at UTC midnight.
 * Use this for database queries where dates are stored as @db.Date.
 */
export function parseDateStringToUTC(dateStr: string): Date {
  // Adding 'Z' suffix makes it explicitly UTC
  return new Date(dateStr + 'T00:00:00Z');
}

/**
 * Parse a YYYY-MM-DD string to get the day of week (0=Sunday, 6=Saturday).
 * This is timezone-safe because we parse as UTC and extract the day.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  const date = parseDateStringToUTC(dateStr);
  return date.getUTCDay();
}

/**
 * Convert a Date object (from database) to a YYYY-MM-DD string.
 * Since @db.Date stores as UTC midnight, toISOString().split('T')[0] is correct.
 */
export function dateToString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the Monday of the week containing the given date string.
 * Returns YYYY-MM-DD string.
 */
export function getMondayOfWeek(dateStr: string): string {
  const date = parseDateStringToUTC(dateStr);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1, Sunday = 0 -> -6
  date.setUTCDate(date.getUTCDate() + diff);
  return dateToString(date);
}

/**
 * Get the Monday of the current week in Eastern Time.
 */
export function getCurrentWeekMondayET(): string {
  const today = getTodayET();
  return getMondayOfWeek(today);
}

/**
 * Add days to a date string. Returns YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseDateStringToUTC(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToString(date);
}

/**
 * Generate an array of date strings for a week starting from the given Monday.
 * Returns 7 YYYY-MM-DD strings (Mon-Sun).
 */
export function getWeekDates(mondayDateStr: string): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(mondayDateStr, i));
  }
  return dates;
}

/**
 * Get week start (Monday) and end (Sunday) as Date objects for database queries.
 * Both are at UTC midnight.
 */
export function getWeekBoundaries(mondayDateStr: string): { weekStart: Date; weekEnd: Date } {
  const weekStart = parseDateStringToUTC(mondayDateStr);
  const sundayStr = addDays(mondayDateStr, 6);
  const weekEnd = parseDateStringToUTC(sundayStr);
  // Set weekEnd to end of day for inclusive queries
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

/**
 * Compare two date strings (YYYY-MM-DD). Returns:
 * - negative if a < b
 * - 0 if a === b
 * - positive if a > b
 */
export function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Check if a date string is before today (in Eastern Time).
 */
export function isBeforeToday(dateStr: string): boolean {
  const today = getTodayET();
  return compareDateStrings(dateStr, today) < 0;
}

/**
 * Check if a date string is today or in the future (in Eastern Time).
 */
export function isTodayOrFuture(dateStr: string): boolean {
  const today = getTodayET();
  return compareDateStrings(dateStr, today) >= 0;
}

/**
 * Format a date string for display in Eastern Time.
 * Options can customize the format.
 */
export function formatDateForDisplay(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
): string {
  // Parse at noon to avoid any edge-case timezone issues when displaying
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { ...options, timeZone: ORG_TIMEZONE });
}
