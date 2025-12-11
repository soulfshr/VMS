import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWeeklyDigestEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

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

// Organization timezone
const ORG_TIMEZONE = 'America/New_York';

// Helper to format date in organization timezone
function formatDateInOrgTimezone(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: ORG_TIMEZONE,
  });
}

// Get next week's date range (Monday to Sunday)
// When called on Sunday, returns the upcoming Mon-Sun
function getNextWeekRange(): { start: Date; end: Date } {
  // Use timezone-aware date calculation
  const now = new Date();

  // Get current day in Eastern Time (0 = Sunday, 1 = Monday, etc.)
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: ORG_TIMEZONE }));
  const dayOfWeek = etNow.getDay();

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

  // Create Monday date at midnight ET
  const monday = new Date(etNow);
  monday.setDate(etNow.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);

  // Create Sunday date at end of day
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

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
    zoneCoverage: {
      covered: number;
      total: number;
    };
  }>;
  totalShifts: number;
  positionsNeeded: number;
}

// GET /api/cron/weekly-digest
// Triggered by Vercel cron hourly on Sundays, checks configured send time
export async function GET(request: NextRequest) {
  // Allow test mode with secret or in development
  const testSecret = request.nextUrl.searchParams.get('secret');
  const isTestMode = request.nextUrl.searchParams.get('test') === 'true' && (
    process.env.NODE_ENV === 'development' ||
    testSecret === process.env.CRON_SECRET
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

    // 2. Check if it's the configured send hour (skip check in test mode)
    if (!isTestMode) {
      const now = new Date();
      const etHour = parseInt(now.toLocaleString('en-US', {
        timeZone: ORG_TIMEZONE,
        hour: 'numeric',
        hour12: false
      }));
      const configuredHour = settings.weeklyDigestSendHour ?? 18;

      if (etHour !== configuredHour) {
        return NextResponse.json({
          success: true,
          message: `Not scheduled hour (current: ${etHour}, configured: ${configuredHour})`,
          sent: 0
        });
      }
    }

    // 3. Calculate next week's date range
    const { start: weekStart, end: weekEnd } = getNextWeekRange();

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
          zone: true,
          volunteers: {
            where: { status: { in: ['CONFIRMED', 'PENDING'] } },
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
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
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

      // Zone coverage for this day
      const dayShifts = shifts.filter(
        s => s.date.toISOString().split('T')[0] === dateStr
      );
      totalShifts += dayShifts.length;

      const coveredZoneIds = new Set(dayShifts.map(s => s.zoneId));
      const coveredZones = coveredZoneIds.size;

      // Count positions needed (dispatchers + zone leads)
      const dispatchersNeeded = dayDispatchers.filter(d => !d.name).length;
      if (!dayRegionalLead) positionsNeeded += 1;
      positionsNeeded += dispatchersNeeded;

      days.push({
        date: currentDate,
        dateStr: formatDateInOrgTimezone(currentDate),
        regionalLead: dayRegionalLead
          ? { name: dayRegionalLead.user.name, isPrimary: dayRegionalLead.isPrimary }
          : null,
        dispatchers: dayDispatchers,
        zoneCoverage: {
          covered: coveredZones,
          total: totalZones,
        },
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
    const recipients = await prisma.user.findMany({
      where: {
        role: { in: ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'] },
        isActive: true,
        emailNotifications: true,
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
