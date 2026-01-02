/**
 * Format Utilities
 *
 * Standardized formatting functions for consistent display across the app.
 * This module re-exports and extends the timezone utilities, providing
 * a single source of truth for all formatting patterns.
 *
 * STANDARDIZED FORMATS:
 * - Date: "Dec 15, 2025" (formatDateStandard)
 * - Date with weekday: "Mon, Dec 15" (formatDateWithDay)
 * - Date full: "Monday, December 15, 2025" (formatDateFull)
 * - Time: "6:00 AM" (formatTimeStandard)
 * - Time range: "6:00 AM - 10:00 AM" (formatTimeRange)
 * - Date ISO: "2025-12-15" (formatDateISO)
 * - Relative: "Today", "Tomorrow", "Yesterday" (formatRelativeDate)
 */

import {
  formatDate,
  formatDisplayDate,
  formatShortDate,
  formatDateWithWeekday,
  formatTime,
  formatDateTime,
  formatHour,
  DEFAULT_TIMEZONE,
} from './timezone';

// Re-export timezone functions that are already standard
export {
  formatDate as formatDateISO,
  formatDisplayDate as formatDateLong,
  formatShortDate,
  formatDateWithWeekday as formatDateFull,
  formatTime as formatTimeStandard,
  formatDateTime,
  formatHour,
  DEFAULT_TIMEZONE,
};

/**
 * Standard date format: "Dec 15, 2025"
 * Use this as the default date format throughout the app.
 */
export function formatDateStandard(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(d);
}

/**
 * Date with weekday: "Mon, Dec 15"
 * Use for compact displays where day of week matters.
 */
export function formatDateWithDay(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(d);
}

/**
 * Date with full weekday: "Monday, December 15, 2025"
 * Use for headers and formal displays.
 */
export function formatDateFullWithYear(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDateWithWeekday(d, timezone);
}

/**
 * Format time range: "6:00 AM - 10:00 AM"
 * Standardized time range format for shifts.
 */
export function formatTimeRange(
  start: Date | string,
  end: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  return `${formatTime(startDate, timezone)} - ${formatTime(endDate, timezone)}`;
}

/**
 * Format relative date: "Today", "Tomorrow", "Yesterday", or standard date.
 * Use for user-friendly date displays.
 */
export function formatRelativeDate(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  // Get date strings in timezone for comparison
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });

  const dateStr = formatter.format(d);
  const todayStr = formatter.format(now);

  // Calculate tomorrow and yesterday
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatter.format(tomorrow);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatter.format(yesterday);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  if (dateStr === yesterdayStr) return 'Yesterday';

  return formatDateStandard(d, timezone);
}

/**
 * Format shift date and time for display.
 * "Mon, Dec 15 | 6:00 AM - 10:00 AM"
 */
export function formatShiftDateTime(
  date: Date | string,
  startTime: Date | string,
  endTime: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateFormatted = formatDateWithDay(date, timezone);
  const timeRange = formatTimeRange(startTime, endTime, timezone);
  return `${dateFormatted} | ${timeRange}`;
}

/**
 * Format phone number for display: "(555) 123-4567"
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Handle different lengths
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // Return original if we can't format
  return phone;
}

/**
 * Format name for display: "John D." or "John Doe" based on privacy setting.
 */
export function formatName(
  name: string | null | undefined,
  abbreviated: boolean = false
): string {
  if (!name) return '';

  if (!abbreviated) return name;

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];

  // "John Doe" → "John D."
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/**
 * Format count with singular/plural label.
 * formatCount(1, 'volunteer') → "1 volunteer"
 * formatCount(5, 'volunteer') → "5 volunteers"
 */
export function formatCount(
  count: number,
  singular: string,
  plural?: string
): string {
  const pluralForm = plural || `${singular}s`;
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Format slots availability: "3 of 5 filled" or "Full"
 */
export function formatSlotsAvailability(
  filled: number,
  total: number
): string {
  if (filled >= total) return 'Full';
  if (filled === 0) return `${total} spots available`;
  return `${filled} of ${total} filled`;
}

/**
 * Format duration in hours and minutes.
 * formatDuration(150) → "2h 30m" (from minutes)
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Calculate and format shift duration.
 */
export function formatShiftDuration(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const minutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  return formatDuration(minutes);
}

/**
 * Truncate text with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
