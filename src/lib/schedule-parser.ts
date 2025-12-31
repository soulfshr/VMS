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
 * Parse cell content to extract activities and times
 */
function parseCellContent(content: string): { activities: string[]; times: string[] } {
  const activities: string[] = [];
  const times: string[] = [];

  if (!content || content.trim() === '') {
    return { activities, times };
  }

  // Split content by common separators (newlines, spaces between activities)
  // Handle patterns like "DE-8:30MM-9:30" or "DE-8:30 MM-9:30"
  const normalized = content.replace(/([A-Z]+)-(\d{1,2}:\d{2})/gi, ' $1-$2 ').trim();
  const tokens = normalized.split(/\s+/).filter(t => t.trim());

  for (const token of tokens) {
    const upper = token.toUpperCase();

    // Check for activity with time like "DE-8:30"
    const activityTimeMatch = upper.match(/^([A-Z]+)-(\d{1,2}:\d{2})$/);
    if (activityTimeMatch) {
      activities.push(activityTimeMatch[1]);
      times.push(activityTimeMatch[2]);
    } else if (NO_SHIFT_ACTIVITIES.includes(upper) || APPOINTMENT_ACTIVITIES.includes(upper)) {
      activities.push(upper);
    }
  }

  return { activities, times };
}

/**
 * Parse a clinic schedule from a .docx file buffer
 * Uses HTML table extraction to properly handle empty cells
 */
export async function parseScheduleDocx(buffer: Buffer): Promise<ParsedSchedule> {
  const errors: string[] = [];

  // Convert to HTML to preserve table structure
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;

  // Also get raw text for header parsing
  const textResult = await mammoth.extractRawText({ buffer });
  const text = textResult.value;
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

  // Extract table from HTML
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) {
    errors.push('Could not find table in document');
    return { month, year, locationCode, days: [], errors };
  }

  // Extract all rows
  const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];

  // Find the header row (contains Sunday, Monday, etc.)
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].toLowerCase().includes('sunday') && rows[i].toLowerCase().includes('monday')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    errors.push('Could not find calendar header row');
    return { month, year, locationCode, days: [], errors };
  }

  // Map to track activities for each day
  const dayActivities = new Map<number, { activities: string[]; times: string[] }>();

  // Process rows after the header (alternating: day numbers row, activities row)
  for (let rowIdx = headerRowIndex + 1; rowIdx < rows.length - 1; rowIdx += 2) {
    const dayNumbersRow = rows[rowIdx];
    const activitiesRow = rows[rowIdx + 1];

    if (!dayNumbersRow || !activitiesRow) continue;

    // Extract cells from both rows
    const dayCells = dayNumbersRow.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    const activityCells = activitiesRow.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];

    // Process each column (0-6 for Sun-Sat)
    for (let col = 0; col < 7 && col < dayCells.length && col < activityCells.length; col++) {
      // Extract day number from cell
      const dayContent = dayCells[col].replace(/<[^>]+>/g, '').trim();
      const dayNum = parseInt(dayContent);

      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
        continue; // Empty or invalid day cell
      }

      // Extract activity from corresponding cell
      const activityContent = activityCells[col].replace(/<[^>]+>/g, '').trim();
      const { activities, times } = parseCellContent(activityContent);

      if (activities.length > 0) {
        dayActivities.set(dayNum, { activities, times });
      }
    }
  }

  // Convert the map to ScheduleDay objects
  const days: ScheduleDay[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const data = dayActivities.get(day);

    if (!data || data.activities.length === 0) {
      continue;
    }

    // Check if any activity in this day should prevent shift creation
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
