/**
 * Centralized Timezone Utilities for RippleVMS
 *
 * This module provides consistent date/time handling across the codebase.
 * All functions are DST-aware using Intl.DateTimeFormat.
 *
 * Key conventions:
 * - Dates are stored in UTC in the database
 * - Display and parsing use the organization's configured timezone
 * - Default timezone is 'America/New_York' (Eastern Time)
 */

import { prisma } from '@/lib/db';

// Default timezone if not configured
export const DEFAULT_TIMEZONE = 'America/New_York';

// Cache for org timezone to avoid repeated DB queries
let cachedTimezone: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Fetch the organization's configured timezone from the database.
 * Results are cached for performance.
 */
export async function getOrgTimezone(): Promise<string> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedTimezone && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedTimezone;
  }

  try {
    const settings = await prisma.organizationSettings.findFirst({
      select: { timezone: true },
    });

    cachedTimezone = settings?.timezone || DEFAULT_TIMEZONE;
    cacheTimestamp = now;
    return cachedTimezone;
  } catch {
    // Fallback to default if DB query fails
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Clear the timezone cache (useful for testing or after settings change)
 */
export function clearTimezoneCache(): void {
  cachedTimezone = null;
  cacheTimestamp = 0;
}

// =============================================================================
// DATE STRING EXTRACTORS
// =============================================================================

/**
 * Creates a function that extracts the hour (0-23) from a Date in the given timezone.
 * Used for determining which time block a shift falls into.
 */
export function createHourExtractor(timezone: string): (date: Date) => number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  });

  return (date: Date): number => {
    const hourPart = formatter.formatToParts(date).find(part => part.type === 'hour');
    if (!hourPart) {
      return date.getUTCHours();
    }

    const hour = parseInt(hourPart.value, 10);
    return Number.isNaN(hour) ? date.getUTCHours() : hour % 24;
  };
}

/**
 * Creates a function that extracts the date string (YYYY-MM-DD) from a Date in the given timezone.
 * This is critical for grouping shifts by their "logical" date in the org's timezone.
 */
export function createDateStringExtractor(timezone: string): (date: Date) => string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });

  return (date: Date): string => {
    // en-CA locale gives us YYYY-MM-DD format
    return formatter.format(date);
  };
}

// =============================================================================
// PARSING FUNCTIONS (User Input → UTC Date for Storage)
// =============================================================================

/**
 * Parse a display date string (YYYY-MM-DD) into a UTC Date.
 * The date represents midnight in the given timezone.
 *
 * Example: parseDisplayDate("2025-12-15", "America/New_York")
 * Returns: Date representing Dec 15, 2025 00:00:00 EST (which is Dec 15, 2025 05:00:00 UTC)
 */
export function parseDisplayDate(dateStr: string, timezone: string): Date {
  // Parse the date components
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create a date string that represents midnight in the target timezone
  // We use a temporary date to find the UTC offset, then adjust
  const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Noon UTC as starting point

  // Get the timezone offset for this date using Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Format the date in the target timezone and parse back
  const parts = formatter.formatToParts(tempDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const tzYear = parseInt(getPart('year'), 10);
  const tzMonth = parseInt(getPart('month'), 10);
  const tzDay = parseInt(getPart('day'), 10);
  const tzHour = parseInt(getPart('hour'), 10);

  // Calculate the offset: if it's 12:00 UTC and shows as 7:00 in ET, offset is -5 hours
  // We want midnight in the target timezone
  const offsetHours = 12 - tzHour;

  // Adjust for day difference (in case crossing midnight)
  let dayAdjust = 0;
  if (tzDay !== day) {
    dayAdjust = tzDay > day ? -24 : 24;
  }

  // Calculate the UTC time that represents midnight in the target timezone
  // For the requested date
  const utcHour = 0 - offsetHours;

  // Create the final date
  const result = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  result.setUTCHours(result.getUTCHours() - offsetHours);

  // Verify the result displays as the correct date in the target timezone
  const verifyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const verifyDate = verifyFormatter.format(result);

  // If verification fails, try alternative calculation
  if (verifyDate !== dateStr) {
    // Alternative: use the date string directly with timezone consideration
    // Create date at noon UTC then find what hour that is in target TZ
    // Then calculate offset to get to midnight
    const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const tzNoonHour = createHourExtractor(timezone)(noonUTC);
    const hoursToMidnight = tzNoonHour; // How many hours past midnight is noon?

    // Go back from noon UTC by the difference to get to midnight in target TZ
    const midnightInTZ = new Date(noonUTC.getTime() - (hoursToMidnight * 60 * 60 * 1000));
    return midnightInTZ;
  }

  return result;
}

/**
 * Parse a display date and time into a UTC Date.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:MM format (24-hour) or ISO string
 * @param timezone - Target timezone
 */
export function parseDisplayDateTime(dateStr: string, timeStr: string, timezone: string): Date {
  // If timeStr is already an ISO string, handle it differently
  if (timeStr.includes('T')) {
    return new Date(timeStr);
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Start with noon UTC on this date
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Find what hour noon UTC is in the target timezone
  const tzNoonHour = createHourExtractor(timezone)(noonUTC);

  // Calculate offset from noon
  const hoursFromNoon = hour - tzNoonHour;

  // Calculate the UTC time
  const result = new Date(noonUTC.getTime() + (hoursFromNoon * 60 * 60 * 1000) + (minute * 60 * 1000));

  return result;
}

// =============================================================================
// FORMATTING FUNCTIONS (UTC Date → Display String)
// =============================================================================

/**
 * Format a UTC Date to a date string (YYYY-MM-DD) in the given timezone.
 */
export function formatDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a UTC Date to a human-readable date string in the given timezone.
 * Example: "December 15, 2025"
 */
export function formatDisplayDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a UTC Date to a short date string in the given timezone.
 * Example: "Dec 15"
 */
export function formatShortDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a UTC Date to a date with weekday in the given timezone.
 * Example: "Monday, December 15, 2025"
 */
export function formatDateWithWeekday(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a UTC Date to a time string in the given timezone.
 * Example: "6:00 AM"
 */
export function formatTime(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a UTC Date to a date and time string in the given timezone.
 * Example: "Dec 15, 2025 at 6:00 AM"
 */
export function formatDateTime(date: Date, timezone: string): string {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
// DATE BOUNDARY HELPERS
// =============================================================================

/**
 * Get the start and end of "today" in the given timezone.
 * Returns UTC Date objects representing midnight to midnight in the timezone.
 */
export function getTodayBounds(timezone: string): { start: Date; end: Date } {
  const now = new Date();
  const todayStr = formatDate(now, timezone);

  const start = parseDisplayDate(todayStr, timezone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

/**
 * Get the start and end of a week containing the given date.
 * Week starts on Sunday.
 */
export function getWeekBounds(date: Date, timezone: string): { start: Date; end: Date } {
  // Get the date string in the timezone
  const dateStr = formatDate(date, timezone);
  const [year, month, day] = dateStr.split('-').map(Number);

  // Find the day of week (0 = Sunday)
  const tempDate = new Date(year, month - 1, day);
  const dayOfWeek = tempDate.getDay();

  // Calculate Sunday of this week
  const sundayDay = day - dayOfWeek;
  const sundayDate = new Date(year, month - 1, sundayDay);
  const sundayStr = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`;

  // Calculate Saturday of this week
  const saturdayDay = sundayDay + 6;
  const saturdayDate = new Date(year, month - 1, saturdayDay);
  const saturdayStr = `${saturdayDate.getFullYear()}-${String(saturdayDate.getMonth() + 1).padStart(2, '0')}-${String(saturdayDate.getDate()).padStart(2, '0')}`;

  const start = parseDisplayDate(sundayStr, timezone);
  const end = new Date(parseDisplayDate(saturdayStr, timezone).getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

/**
 * Check if a date is in the future in the given timezone.
 */
export function isFuture(date: Date, timezone: string): boolean {
  const { start: todayStart } = getTodayBounds(timezone);
  return date >= todayStart;
}

/**
 * Check if a date is today in the given timezone.
 */
export function isToday(date: Date, timezone: string): boolean {
  const todayStr = formatDate(new Date(), timezone);
  const dateStr = formatDate(date, timezone);
  return todayStr === dateStr;
}

/**
 * Get the day of week (0 = Sunday, 6 = Saturday) for a date in the given timezone.
 */
export function getDayOfWeek(date: Date, timezone: string): number {
  const dateStr = formatDate(date, timezone);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}
