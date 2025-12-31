import mammoth from 'mammoth';

export interface ScheduleDay {
  date: Date;
  appointmentType: string; // DE, MM, CONSULTS, etc.
  appointmentTime: string; // e.g., "8:30"
  isClosed: boolean;
  isAdmin: boolean;
}

export interface ParsedSchedule {
  month: number; // 0-11
  year: number;
  locationCode: string; // e.g., "RAL"
  days: ScheduleDay[];
  errors: string[];
}

// Activity codes that should NOT create shifts (normalized to uppercase)
const NO_SHIFT_ACTIVITIES = ['CLOSED', 'ADMIN'];

// Activity codes that SHOULD create shifts (appointment types)
const APPOINTMENT_ACTIVITIES = ['DE', 'MM', 'CONSULTS'];

/**
 * Normalize an activity code for comparison
 * Handles variations like "Admin", "ADMIN", "admin", etc.
 */
function normalizeActivity(activity: string): string {
  return activity.trim().toUpperCase();
}

/**
 * Check if an activity should prevent shift creation
 */
function isNoShiftActivity(activity: string): boolean {
  const normalized = normalizeActivity(activity);
  return NO_SHIFT_ACTIVITIES.includes(normalized);
}

/**
 * Check if a token is an activity (with or without time)
 */
function isActivityToken(token: string): boolean {
  const upper = token.toUpperCase();
  // Check for activity with time like "DE-8:30"
  if (/^[A-Z]+-\d{1,2}:\d{2}$/.test(token)) {
    return true;
  }
  // Check for standalone activity
  return NO_SHIFT_ACTIVITIES.includes(upper) || APPOINTMENT_ACTIVITIES.includes(upper);
}

/**
 * Parse a clinic schedule from a .docx file buffer
 */
export async function parseScheduleDocx(buffer: Buffer): Promise<ParsedSchedule> {
  const errors: string[] = [];

  // Extract text from docx
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  // Split into tokens (words/numbers)
  const tokens = text.split(/\s+/).filter(t => t.trim());

  if (tokens.length === 0) {
    return { month: 0, year: 0, locationCode: '', days: [], errors: ['Empty document'] };
  }

  // Parse header: "January-RAL" "2026" or "January-RAL2026"
  const headerToken = tokens[0];
  const headerMatch = headerToken.match(/^([A-Za-z]+)-([A-Z]+)(\d{4})?$/);

  if (!headerMatch) {
    errors.push(`Could not parse header: ${headerToken}`);
    return { month: 0, year: 0, locationCode: '', days: [], errors };
  }

  const monthName = headerMatch[1];
  const locationCode = headerMatch[2];
  let year = headerMatch[3] ? parseInt(headerMatch[3]) : 0;

  // If year wasn't in header, check next token
  if (!year && tokens[1] && /^\d{4}$/.test(tokens[1])) {
    year = parseInt(tokens[1]);
  }

  // Convert month name to number
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const month = monthNames.indexOf(monthName.toLowerCase());

  if (month === -1) {
    errors.push(`Unknown month: ${monthName}`);
    return { month: 0, year, locationCode, days: [], errors };
  }

  if (!year) {
    errors.push('Could not determine year');
    return { month, year: 0, locationCode, days: [], errors };
  }

  // Find the days of week header to know where calendar data starts
  let calendarStartIndex = -1;

  for (let i = 0; i < tokens.length - 6; i++) {
    if (tokens[i].toLowerCase() === 'sunday' &&
        tokens[i + 1].toLowerCase() === 'monday') {
      calendarStartIndex = i + 7; // Skip the day names
      break;
    }
  }

  if (calendarStartIndex === -1) {
    errors.push('Could not find calendar header');
    return { month, year, locationCode, days: [], errors };
  }

  // Get the number of days in this month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Find what day of week the 1st falls on (0 = Sunday)
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Parse the calendar grid
  // Structure: each week row has day numbers first, then activities for each day
  // Activities are in column order (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
  const calendarTokens = tokens.slice(calendarStartIndex);

  // Map to track activities for each day
  const dayActivities = new Map<number, { activities: string[], times: string[] }>();

  let i = 0;

  // Process week by week
  while (i < calendarTokens.length) {
    // Collect day numbers for this week row
    const weekDays: number[] = [];
    while (i < calendarTokens.length) {
      const token = calendarTokens[i];
      const dayNum = parseInt(token);

      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
        weekDays.push(dayNum);
        i++;
      } else {
        break; // Hit non-number, must be activities
      }
    }

    if (weekDays.length === 0) {
      i++;
      continue;
    }

    // Now collect activities for this week
    // We need to figure out which column each day is in
    // For the first week, days start at column = firstDayOfWeek
    // For subsequent weeks, days start at column 0 (Sunday)

    const firstDayInWeek = weekDays[0];
    let startColumn: number;

    if (firstDayInWeek === 1) {
      // First week - days start at the column for the 1st
      startColumn = firstDayOfWeek;
    } else {
      // Subsequent weeks - first day is a Sunday (column 0)
      startColumn = 0;
    }

    // Create a mapping from column index to day number
    const columnToDay: (number | null)[] = [null, null, null, null, null, null, null];
    for (let j = 0; j < weekDays.length; j++) {
      const col = startColumn + j;
      if (col < 7) {
        columnToDay[col] = weekDays[j];
      }
    }

    // Initialize day activities
    for (const day of weekDays) {
      if (!dayActivities.has(day)) {
        dayActivities.set(day, { activities: [], times: [] });
      }
    }

    // Collect all activities for this week row
    const weekActivities: { activity: string; time: string | null }[] = [];

    while (i < calendarTokens.length && isActivityToken(calendarTokens[i])) {
      const token = calendarTokens[i];

      // Check if token is an activity with time (e.g., "DE-8:30")
      const activityTimeMatch = token.match(/^([A-Z]+)-(\d{1,2}:\d{2})$/);
      if (activityTimeMatch) {
        weekActivities.push({ activity: activityTimeMatch[1], time: activityTimeMatch[2] });
      } else {
        weekActivities.push({ activity: token.toUpperCase(), time: null });
      }
      i++;
    }

    // Assign activities to days
    // The activities appear in column order for cells that have content
    // Each cell can have multiple activities
    let activityIndex = 0;
    for (let col = 0; col < 7 && activityIndex < weekActivities.length; col++) {
      const dayNum = columnToDay[col];
      if (dayNum === null) continue;

      const dayData = dayActivities.get(dayNum)!;

      // A cell typically has either:
      // - CLOSED or ADMIN (single activity)
      // - Two activities like DE-8:30 + MM-9:30
      // - CONSULTS (single activity)

      // Peek at what's next to determine how many activities belong to this cell
      const act = weekActivities[activityIndex];

      if (act.activity === 'CLOSED' || act.activity === 'ADMIN') {
        // Single activity cell
        dayData.activities.push(act.activity);
        activityIndex++;
      } else if (act.time) {
        // Activity with time - might have a pair
        dayData.activities.push(act.activity);
        dayData.times.push(act.time);
        activityIndex++;

        // Check if next activity also has a time (paired activities)
        if (activityIndex < weekActivities.length) {
          const next = weekActivities[activityIndex];
          if (next.time) {
            dayData.activities.push(next.activity);
            dayData.times.push(next.time);
            activityIndex++;
          }
        }
      } else {
        // Standalone activity like CONSULTS
        dayData.activities.push(act.activity);
        activityIndex++;
      }
    }
  }

  // Convert the map to ScheduleDay objects
  const days: ScheduleDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const data = dayActivities.get(day);

    if (!data || data.activities.length === 0) {
      continue;
    }

    // Check if any activity in this day should prevent shift creation
    // Using the normalized comparison for robustness
    const hasNoShiftActivity = data.activities.some(act => isNoShiftActivity(act));

    // Skip days that are closed or admin
    if (hasNoShiftActivity) {
      continue;
    }

    // Find the earliest appointment time
    let earliestTime = '';
    let appointmentType = '';

    for (let j = 0; j < data.activities.length; j++) {
      const activity = data.activities[j];
      const time = data.times[j];

      if (time && APPOINTMENT_ACTIVITIES.includes(activity)) {
        if (!earliestTime || compareTimeStrings(time, earliestTime) < 0) {
          earliestTime = time;
          appointmentType = activity;
        }
      } else if (!appointmentType && APPOINTMENT_ACTIVITIES.includes(activity)) {
        // Activity without time (like standalone CONSULTS)
        appointmentType = activity;
      }
    }

    if (appointmentType) {
      days.push({
        date: new Date(year, month, day),
        appointmentType,
        appointmentTime: earliestTime || '9:00', // Default time if none specified
        isClosed: false,
        isAdmin: false,
      });
    }
  }

  return { month, year, locationCode, days, errors };
}

/**
 * Compare two time strings (HH:MM format)
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
function compareTimeStrings(a: string, b: string): number {
  const [aHours, aMinutes] = a.split(':').map(Number);
  const [bHours, bMinutes] = b.split(':').map(Number);

  const aTotal = aHours * 60 + aMinutes;
  const bTotal = bHours * 60 + bMinutes;

  return aTotal - bTotal;
}

/**
 * Convert parsed schedule to shift data for import
 * Creates 2-hour shifts centered around the appointment time
 */
export function scheduleToShifts(
  schedule: ParsedSchedule,
  options: {
    zoneName: string;
    shiftType: string;
    shiftDurationMinutes?: number;
    offsetBeforeMinutes?: number;
    title?: string;
  }
): Array<{
  title: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  zoneName: string;
  shiftType: string;
}> {
  const {
    zoneName,
    shiftType,
    shiftDurationMinutes = 120, // 2 hours default
    offsetBeforeMinutes = 30, // Start 30 min before appointment
    title: customTitle,
  } = options;

  return schedule.days.map(day => {
    // Parse the appointment time
    const [hours, minutes] = day.appointmentTime.split(':').map(Number);

    // Calculate shift start time (30 min before appointment by default)
    const appointmentMinutes = hours * 60 + minutes;
    const startMinutes = appointmentMinutes - offsetBeforeMinutes;

    const startHours = Math.floor(startMinutes / 60);
    const startMins = startMinutes % 60;

    // Calculate end time
    const endMinutes = startMinutes + shiftDurationMinutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    // Create date objects
    const startTime = new Date(day.date);
    startTime.setHours(startHours, startMins, 0, 0);

    const endTime = new Date(day.date);
    endTime.setHours(endHours, endMins, 0, 0);

    // Generate title
    const dateStr = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const generatedTitle = customTitle || `${schedule.locationCode} - ${dateStr}`;

    return {
      title: generatedTitle,
      date: day.date,
      startTime,
      endTime,
      zoneName,
      shiftType,
    };
  });
}
