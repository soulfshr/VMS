import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWeeklyDigestEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { getOrgTimezone } from '@/lib/timezone';

// Verify cron request is from Vercel
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In development, allow requests without auth
    if (process.env.NODE_ENV === 'development') return true;
    // Also allow if CRON_SECRET is not set (for initial setup)
    if (!process.env.CRON_SECRET) return true;
    return false;
  }
  return true;
}

// Helper to format date in organization timezone
function formatDateWithWeekday(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
}

// Get next week's date range (Monday to Sunday)
// When called on Sunday, returns the upcoming Mon-Sun
function getNextWeekRange(timezone: string): { start: Date; end: Date } {
  // Use timezone-aware date calculation
  const now = new Date();

  // Get current day in the configured timezone (0 = Sunday, 1 = Monday, etc.)
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const dayOfWeek = tzNow.getDay();

  // Calculate days until next Monday
  // If today is Sunday (0), next Monday is 1 day away
  // If today is Monday (1), next Monday is 7 days away
  // If today is Saturday (6), next Monday is 2 days away
  let daysUntilMonday: number;
  if (dayOfWeek === 0) {
    daysUntilMonday = 1; // Sunday -> Monday is 1 day
  } else {
    daysUntilMonday = 8 - dayOfWeek; // e.g., Monday (1) -> 7, Tuesday (2) -> 6, etc.
  }

  // Create Monday date at noon UTC to avoid timezone rollback issues
  // (midnight UTC converts to previous day in US timezones)
  const monday = new Date(tzNow);
  monday.setDate(tzNow.getDate() + daysUntilMonday);
  monday.setUTCHours(12, 0, 0, 0);

  // Create Sunday date at noon UTC
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(12, 0, 0, 0);

  return { start: monday, end: sunday };
}

export interface WeeklyDigestData {
  weekStart: Date;
  weekEnd: Date;
  days: Array<{
    date: Date;
    dateStr: string;
    regionalLead: { name: string; isPrimary: boolean } | null;
    dispatchers: Array<{
      county: string;
      name: string | null;
      isBackup: boolean;
    }>;
    zoneLeads: Array<{
      zone: string;
      name: string | null;
    }>;
  }>;
  totalShifts: number;
  positionsNeeded: number;
}

// GET /api/cron/weekly-digest
// Triggered by Vercel cron hourly on Sundays, checks configured send time
export async function GET(request: NextRequest) {
  // Allow test mode with secret, in development, or when no secret is configured
  const testSecret = request.nextUrl.searchParams.get('secret');
  const isTestMode = request.nextUrl.searchParams.get('test') === 'true' && (
    process.env.NODE_ENV === 'development' ||
    testSecret === process.env.CRON_SECRET ||
    !process.env.CRON_SECRET // Allow test mode if no secret configured
  );

  // Verify cron request
  if (!isTestMode && !verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Check if weeklyDigestEnabled is true
    const settings = await prisma.organizationSettings.findFirst();

    if (!settings?.weeklyDigestEnabled) {
      await logger.info('SYSTEM', 'Weekly digest skipped - feature disabled');
      return NextResponse.json({
        success: true,
        message: 'Weekly digest is disabled',
        sent: 0
      });
    }

    // Get organization timezone from settings
    const timezone = await getOrgTimezone();

    // 2. Check if it's the configured send hour (skip check in test mode)
    if (!isTestMode) {
      const now = new Date();
      const currentHour = parseInt(now.toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      }));
      const configuredHour = settings.weeklyDigestSendHour ?? 18;

      if (currentHour !== configuredHour) {
        return NextResponse.json({
          success: true,
          message: `Not scheduled hour (current: ${currentHour}, configured: ${configuredHour})`,
          sent: 0
        });
      }
    }

    // 3. Calculate next week's date range
    const { start: weekStart, end: weekEnd } = getNextWeekRange(timezone);

    // 4. Fetch schedule data for the week
    const [zones, counties, shifts, dispatcherAssignments, regionalLeads] = await Promise.all([
      // Get all active zones
      prisma.zone.findMany({
        where: { isActive: true },
        select: { id: true, name: true, county: true },
      }),
      // Get distinct counties
      prisma.zone.findMany({
        where: { isActive: true, county: { not: null } },
        select: { county: true },
        distinct: ['county'],
      }),
      // Get published shifts for the week
      prisma.shift.findMany({
        where: {
          date: { gte: weekStart, lte: weekEnd },
          status: 'PUBLISHED',
        },
        include: {
          zone: { select: { id: true, name: true } },
          volunteers: {
            where: { status: 'CONFIRMED', isZoneLead: true },
            select: { id: true, isZoneLead: true, user: { select: { name: true } } },
          },
        },
      }),
      // Get dispatcher assignments
      prisma.dispatcherAssignment.findMany({
        where: {
          date: { gte: weekStart, lte: weekEnd },
        },
        include: {
          user: { select: { name: true } },
        },
      }),
      // Get regional lead assignments
      prisma.regionalLeadAssignment.findMany({
        where: {
          date: { gte: weekStart, lte: weekEnd },
        },
        include: {
          user: { select: { name: true } },
        },
      }),
    ]);

    const uniqueCounties = counties
      .map(c => c.county)
      .filter((c): c is string => c !== null);
    const totalZones = zones.length;

    // Build day-by-day data
    const days: WeeklyDigestData['days'] = [];
    let totalShifts = 0;
    let positionsNeeded = 0;

    for (let i = 0; i < 7; i++) {
      // Use UTC methods to avoid timezone issues
      // weekStart is already at noon UTC, so adding days keeps it at noon
      const currentDate = new Date(weekStart);
      currentDate.setUTCDate(weekStart.getUTCDate() + i);
      currentDate.setUTCHours(12, 0, 0, 0); // Ensure noon UTC
      const dateStr = currentDate.toISOString().split('T')[0];

      // Regional lead for this day
      const dayRegionalLead = regionalLeads.find(
        rl => rl.date.toISOString().split('T')[0] === dateStr
      );

      // Dispatchers for this day (get unique by county)
      const dayDispatchers = uniqueCounties.map(county => {
        const assignment = dispatcherAssignments.find(
          da => da.county === county &&
                da.date.toISOString().split('T')[0] === dateStr &&
                !da.isBackup
        );
        return {
          county,
          name: assignment?.user.name || null,
          isBackup: false,
        };
      });

      // Zone leads for this day - get zone lead for each zone
      const dayShifts = shifts.filter(
        s => s.date.toISOString().split('T')[0] === dateStr
      );
      totalShifts += dayShifts.length;

      // Build zone leads list - for each zone, find who's leading that day
      const dayZoneLeads = zones.map(zone => {
        // Find shifts for this zone on this day
        const zoneShifts = dayShifts.filter(s => s.zone.id === zone.id);
        // Get the zone lead from any shift in this zone (take the first one found)
        const zoneLead = zoneShifts
          .flatMap(s => s.volunteers)
          .find(v => v.isZoneLead);
        return {
          zone: zone.name,
          name: zoneLead?.user?.name || null,
        };
      });

      // Count positions needed (dispatchers + regional leads + zones without leads)
      const dispatchersNeeded = dayDispatchers.filter(d => !d.name).length;
      const zoneLeadsNeeded = dayZoneLeads.filter(z => !z.name).length;
      if (!dayRegionalLead) positionsNeeded += 1;
      positionsNeeded += dispatchersNeeded;
      positionsNeeded += zoneLeadsNeeded;

      days.push({
        date: currentDate,
        dateStr: formatDateWithWeekday(currentDate, timezone),
        regionalLead: dayRegionalLead
          ? { name: dayRegionalLead.user.name, isPrimary: dayRegionalLead.isPrimary }
          : null,
        dispatchers: dayDispatchers,
        zoneLeads: dayZoneLeads,
      });
    }

    const scheduleData: WeeklyDigestData = {
      weekStart,
      weekEnd,
      days,
      totalShifts,
      positionsNeeded,
    };

    // 5. Query eligible recipients
    // In test mode, allow filtering by specific email address
    const testEmail = isTestMode ? request.nextUrl.searchParams.get('email') : null;

    const recipients = await prisma.user.findMany({
      where: {
        role: { in: ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'] },
        isActive: true,
        emailNotifications: true,
        ...(testEmail ? { email: testEmail } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        unsubscribeToken: true,
      },
    });

    if (recipients.length === 0) {
      await logger.info('SYSTEM', 'Weekly digest skipped - no eligible recipients');
      return NextResponse.json({
        success: true,
        message: 'No eligible recipients',
        sent: 0
      });
    }

    // 6. Send emails
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        await sendWeeklyDigestEmail({
          to: recipient.email,
          recipientName: recipient.name,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          scheduleData,
          unsubscribeToken: recipient.unsubscribeToken || undefined,
        });
        sentCount++;
      } catch (error) {
        failedCount++;
        await logger.error('EMAIL', 'Failed to send weekly digest', {
          to: recipient.email,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // 7. Log results
    await logger.info('SYSTEM', 'Weekly digest completed', {
      totalRecipients: recipients.length,
      sent: sentCount,
      failed: failedCount,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Weekly digest sent',
      sent: sentCount,
      failed: failedCount,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });
  } catch (error) {
    console.error('Weekly digest cron error:', error);
    await logger.error('SYSTEM', 'Weekly digest cron failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { error: 'Weekly digest failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
