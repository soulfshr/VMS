import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { sendBlastEmail, generateUnsubscribeToken, generateShiftListHtml, ShiftForListing, generateTrainingListHtml, TrainingForListing } from '@/lib/email';
import { Role, Qualification, EmailTemplate, EmailBlastStatus, EmailSendStatus } from '@/generated/prisma/enums';
import { EmailBlastFilters } from './preview/route';

// Email blast templates
const TEMPLATES: Record<EmailTemplate, { subject: string; body: string }> = {
  GENERAL_NEWSLETTER: {
    subject: 'Siembra NC Update',
    body: `We wanted to share some updates with you about what's happening at Siembra NC.

{{content}}

Thank you for being part of our community!

- The Siembra NC Team`,
  },
  SCHEDULE_ANNOUNCEMENT: {
    subject: 'New Volunteer Shifts Available',
    body: `{{content}}
{{zoneShifts}}
<a href="https://siembra-ripple.honeybadgerapps.com/shifts" style="display: inline-block; background: #0d9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 12px;">View All Shifts & Sign Up</a>

Thank you for your dedication to our community!`,
  },
  TRAINING_ANNOUNCEMENT: {
    subject: 'Upcoming Training Sessions',
    body: `{{content}}
{{upcomingTrainings}}
<a href="https://siembra-ripple.honeybadgerapps.com/trainings" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 12px;">View All Trainings & RSVP</a>

Looking forward to seeing you there!`,
  },
  FREEFORM: {
    subject: '',
    body: '',
  },
};

// POST /api/admin/email-blast - Send email blast
export async function POST(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { template, subject, content, filters, dateRange } = body as {
      template: EmailTemplate;
      subject: string;
      content: string;
      filters: EmailBlastFilters;
      dateRange?: { startDate: string; endDate: string };
    };

    if (!template || !subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: template, subject, content' },
        { status: 400 }
      );
    }

    // Build where clause based on filters (same as preview)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isActive: true,
      emailNotifications: true,
    };

    if (filters?.roles && filters.roles.length > 0) {
      where.role = { in: filters.roles as Role[] };
    }

    if (filters?.hasQualifications === 'yes') {
      where.qualifications = { isEmpty: false };
    } else if (filters?.hasQualifications === 'no') {
      where.qualifications = { isEmpty: true };
    } else if (filters?.qualifications && filters.qualifications.length > 0) {
      where.qualifications = { hasSome: filters.qualifications as Qualification[] };
    }

    if (filters?.zones && filters.zones.length > 0) {
      where.zones = {
        some: {
          zoneId: { in: filters.zones },
        },
      };
    }

    if (filters?.languages && filters.languages.length > 0) {
      where.OR = filters.languages.map(lang => ({
        OR: [
          { primaryLanguage: lang },
          { otherLanguages: { has: lang } },
        ],
      }));
    }

    // Get all recipients
    const recipients = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        unsubscribeToken: true,
      },
    });

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients match the selected filters' },
        { status: 400 }
      );
    }

    // Prepare body content using template
    const templateConfig = TEMPLATES[template];
    const finalBody = template === 'FREEFORM'
      ? content
      : templateConfig.body.replace('{{content}}', content);

    // Create email blast record
    const blast = await prisma.emailBlast.create({
      data: {
        subject,
        body: finalBody,
        template,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filters: JSON.parse(JSON.stringify(filters || {})) as any,
        recipientCount: recipients.length,
        sentById: user.id,
        status: EmailBlastStatus.SENDING,
        sentAt: new Date(),
        recipients: {
          create: recipients.map(r => ({
            userId: r.id,
            email: r.email,
            status: EmailSendStatus.PENDING,
          })),
        },
      },
    });

    // Parse date range for schedule announcement (defaults to next 14 days)
    const scheduleStartDate = dateRange?.startDate
      ? new Date(dateRange.startDate)
      : new Date();
    const scheduleEndDate = dateRange?.endDate
      ? new Date(dateRange.endDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Send emails (fire and forget pattern)
    const sendEmails = async () => {
      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        // Ensure user has unsubscribe token
        let unsubscribeToken = recipient.unsubscribeToken;
        if (!unsubscribeToken) {
          unsubscribeToken = generateUnsubscribeToken();
          await prisma.user.update({
            where: { id: recipient.id },
            data: { unsubscribeToken },
          });
        }

        // For SCHEDULE_ANNOUNCEMENT, generate zone-specific shift listings
        let personalizedBody = finalBody;
        if (template === 'SCHEDULE_ANNOUNCEMENT') {
          // Fetch recipient's zones
          const recipientWithZones = await prisma.user.findUnique({
            where: { id: recipient.id },
            include: {
              zones: { select: { zoneId: true } },
            },
          });

          const zoneIds = recipientWithZones?.zones.map(z => z.zoneId) || [];

          // Build shift query - if user has zones, filter by them; otherwise show all
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const shiftWhere: any = {
            status: 'PUBLISHED',
            date: {
              gte: scheduleStartDate,
              lte: scheduleEndDate,
            },
          };
          if (zoneIds.length > 0) {
            shiftWhere.zoneId = { in: zoneIds };
          }

          // Fetch upcoming shifts with openings
          const shifts = await prisma.shift.findMany({
            where: shiftWhere,
            include: {
              zone: { select: { name: true } },
              volunteers: {
                where: { status: 'CONFIRMED' },
                select: { id: true },
              },
            },
            orderBy: { date: 'asc' },
            take: 10,
          });

          // Filter to only shifts with openings
          const shiftsWithOpenings: ShiftForListing[] = shifts
            .filter(s => s.volunteers.length < s.maxVolunteers)
            .map(s => ({
              title: s.title,
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              maxVolunteers: s.maxVolunteers,
              confirmedCount: s.volunteers.length,
              zone: s.zone,
            }));

          const shiftListHtml = generateShiftListHtml(shiftsWithOpenings, zoneIds.length === 0);
          personalizedBody = personalizedBody.replace('{{zoneShifts}}', shiftListHtml);
        }

        // For TRAINING_ANNOUNCEMENT, generate upcoming training sessions listing
        if (template === 'TRAINING_ANNOUNCEMENT') {
          // Fetch upcoming training sessions with openings
          const trainingSessions = await prisma.trainingSession.findMany({
            where: {
              status: 'PUBLISHED',
              date: {
                gte: scheduleStartDate,
                lte: scheduleEndDate,
              },
            },
            include: {
              trainingType: { select: { name: true } },
              attendees: {
                where: { status: 'CONFIRMED' },
                select: { id: true },
              },
            },
            orderBy: { date: 'asc' },
            take: 10,
          });

          // Filter to only trainings with openings
          const trainingsWithOpenings: TrainingForListing[] = trainingSessions
            .filter(t => t.attendees.length < t.maxAttendees)
            .map(t => ({
              title: t.title,
              date: t.date,
              startTime: t.startTime,
              endTime: t.endTime,
              location: t.location,
              meetingLink: t.meetingLink,
              maxAttendees: t.maxAttendees,
              confirmedCount: t.attendees.length,
              trainingType: t.trainingType,
            }));

          const trainingListHtml = generateTrainingListHtml(trainingsWithOpenings);
          personalizedBody = personalizedBody.replace('{{upcomingTrainings}}', trainingListHtml);
        }

        const result = await sendBlastEmail({
          to: recipient.email,
          recipientName: recipient.name,
          subject,
          body: personalizedBody,
          unsubscribeToken,
        });

        // Update recipient status
        await prisma.emailBlastRecipient.updateMany({
          where: {
            blastId: blast.id,
            userId: recipient.id,
          },
          data: {
            status: result.success ? EmailSendStatus.SENT : EmailSendStatus.FAILED,
            sentAt: result.success ? new Date() : null,
            error: result.error || null,
          },
        });

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }

        // Small delay between emails (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update blast status
      await prisma.emailBlast.update({
        where: { id: blast.id },
        data: {
          status: failedCount === recipients.length ? EmailBlastStatus.FAILED : EmailBlastStatus.COMPLETED,
          sentCount,
          failedCount,
        },
      });

      console.log(`[Email Blast] Completed: ${sentCount} sent, ${failedCount} failed`);
      return { sentCount, failedCount };
    };

    // Await the email sending - fire-and-forget doesn't work in Vercel serverless
    try {
      const result = await sendEmails();
      return NextResponse.json({
        message: `Email blast completed: ${result.sentCount} sent, ${result.failedCount} failed`,
        blastId: blast.id,
        recipientCount: recipients.length,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      });
    } catch (err) {
      console.error('[Email Blast] Error during send:', err);
      await prisma.emailBlast.update({
        where: { id: blast.id },
        data: { status: EmailBlastStatus.FAILED },
      });
      return NextResponse.json({
        message: 'Email blast failed',
        blastId: blast.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error sending email blast:', error);
    return NextResponse.json(
      { error: 'Failed to send email blast' },
      { status: 500 }
    );
  }
}

// GET /api/admin/email-blast - List email blast history
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['COORDINATOR', 'ADMINISTRATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [blasts, total] = await Promise.all([
      prisma.emailBlast.findMany({
        select: {
          id: true,
          subject: true,
          template: true,
          status: true,
          recipientCount: true,
          sentCount: true,
          failedCount: true,
          sentAt: true,
          createdAt: true,
          sentBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.emailBlast.count(),
    ]);

    return NextResponse.json({
      blasts,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching email blast history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email blast history' },
      { status: 500 }
    );
  }
}
