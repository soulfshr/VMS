/**
 * Client-Side Timezone Utilities for RippleVMS
 *
 * Lightweight formatting functions for React components.
 * These mirror the server-side utilities but are designed for client use.
 *
 * Note: These functions require a timezone parameter. Components should
 * get the timezone from organization settings (typically passed via props or context).
 */

// Default timezone - should match server default
export const DEFAULT_TIMEZONE = 'America/New_York';

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

/**
 * Format a Date to a display string (e.g., "Dec 15, 2025")
 */
export function formatDateForDisplay(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a Date to a long display string (e.g., "December 15, 2025")
 */
export function formatLongDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a Date to a weekday + date string (e.g., "Monday, Dec 15")
 */
export function formatDateWithWeekday(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a Date to a short weekday + date string (e.g., "Mon, Dec 15")
 */
export function formatShortDateWithWeekday(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a Date to a time string (e.g., "6:00 AM")
 */
export function formatTimeForDisplay(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a Date to a date and time string (e.g., "Dec 15 at 6:00 AM")
 */
export function formatDateTimeForDisplay(date: Date, timezone: string): string {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  return `${dateFormatter.format(date)} at ${timeFormatter.format(date)}`;
}

/**
 * Get a date string suitable for HTML date inputs (YYYY-MM-DD)
 * This extracts the date in the given timezone.
 */
export function getDateInputValue(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Get a time string suitable for HTML time inputs (HH:MM)
 * This extracts the time in the given timezone.
 */
export function getTimeInputValue(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format an hour number (0-23) to a display string.
 * Example: 6 → "6am", 14 → "2pm"
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

// =============================================================================
// DATE COMPARISON HELPERS
// =============================================================================

/**
 * Check if two dates represent the same day in the given timezone.
 */
export function isSameDay(date1: Date, date2: Date, timezone: string): boolean {
  return getDateInputValue(date1, timezone) === getDateInputValue(date2, timezone);
}

/**
 * Check if a date is today in the given timezone.
 */
export function isToday(date: Date, timezone: string): boolean {
  return isSameDay(date, new Date(), timezone);
}

/**
 * Check if a date is in the past in the given timezone.
 */
export function isPast(date: Date, timezone: string): boolean {
  const todayStr = getDateInputValue(new Date(), timezone);
  const dateStr = getDateInputValue(date, timezone);
  return dateStr < todayStr;
}

/**
 * Check if a date is in the future in the given timezone.
 */
export function isFuture(date: Date, timezone: string): boolean {
  const todayStr = getDateInputValue(new Date(), timezone);
  const dateStr = getDateInputValue(date, timezone);
  return dateStr > todayStr;
}
