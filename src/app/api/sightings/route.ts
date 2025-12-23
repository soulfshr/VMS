import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';
import { SightingStatus } from '@/generated/prisma/enums';
import { sendSightingNotificationToDispatchers } from '@/lib/email';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { getCurrentOrgId, getOrgIdForCreate } from '@/lib/org-context';

// POST /api/sightings - Create a new ICE sighting report
// - PUBLIC submissions (unauthenticated): All SALUTE fields required, status = NEW
// - DISPATCHER entries (authenticated): Only location required, status = REVIEWING, auto-assigned
export async function POST(request: NextRequest) {
  // Rate limiting for public endpoint
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimitAsync(`sighting:${clientIp}`, RATE_LIMITS.sighting);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    // Check if user is authenticated (dispatcher entry mode)
    const user = await getDbUser();
    const isDispatcherEntry = !!user;

    const body = await request.json();

    const {
      // SALUTE fields
      size,
      activity,
      location,
      latitude,
      longitude,
      uniform,
      observedAt,
      equipment,
      // Optional reporter info
      reporterName,
      reporterPhone,
      reporterEmail,
      // Media URLs (already uploaded to Vercel Blob)
      mediaUrls,
      // Optional notes for dispatcher entry
      notes,
    } = body;

    // Validate required fields based on mode
    if (isDispatcherEntry) {
      // Dispatcher entry: only location is required
      if (!location) {
        return NextResponse.json(
          { error: 'Location is required' },
          { status: 400 }
        );
      }
    } else {
      // Public submission: all SALUTE fields required
      if (!size || !activity || !location || !uniform || !observedAt || !equipment) {
        return NextResponse.json(
          { error: 'All SALUTE fields are required' },
          { status: 400 }
        );
      }
    }

    // Get org context for the sighting
    const orgId = await getOrgIdForCreate();

    // Create the sighting with media
    const sighting = await prisma.iceSighting.create({
      data: {
        organizationId: orgId,
        // SALUTE fields - use empty string for required fields if not provided (dispatcher mode)
        size: size || '',
        activity: activity || '',
        location,
        latitude: latitude || null,
        longitude: longitude || null,
        uniform: uniform || '',
        observedAt: observedAt ? new Date(observedAt) : new Date(),
        equipment: equipment || '',
        // Reporter info
        reporterName: reporterName || null,
        reporterPhone: reporterPhone || null,
        reporterEmail: reporterEmail || null,
        // Workflow: REVIEWING for dispatchers, NEW for public submissions
        status: isDispatcherEntry ? SightingStatus.REVIEWING : SightingStatus.NEW,
        // Auto-assign to dispatcher who created it
        assignedToId: isDispatcherEntry ? user.id : null,
        notes: notes || null,
        // Media attachments
        media: mediaUrls?.length > 0 ? {
          create: mediaUrls.map((media: { url: string; type: string; filename: string; size: number }) => ({
            url: media.url,
            type: media.type as 'IMAGE' | 'VIDEO',
            filename: media.filename,
            size: media.size,
          })),
        } : undefined,
      },
      include: {
        media: true,
      },
    });

    // Send email notification to all dispatchers (only for public submissions)
    if (!isDispatcherEntry) {
      try {
        // Get all users with DISPATCHER role or DISPATCHER qualification
        const dispatchers = await prisma.user.findMany({
          where: {
            OR: [
              { role: 'DISPATCHER' },
              { qualifications: { has: 'DISPATCHER' } },
            ],
          },
          select: {
            email: true,
            name: true,
          },
        });

        if (dispatchers.length > 0) {
          await sendSightingNotificationToDispatchers(
            {
              sightingId: sighting.id,
              size: sighting.size,
              activity: sighting.activity,
              location: sighting.location,
              uniform: sighting.uniform,
              observedAt: sighting.observedAt,
              equipment: sighting.equipment,
              hasMedia: sighting.media.length > 0,
              reporterName: sighting.reporterName,
            },
            dispatchers.map((d) => ({ email: d.email, name: d.name || 'Dispatcher' }))
          );
          console.log(`[Sightings] Notified ${dispatchers.length} dispatchers of new sighting ${sighting.id}`);
        }
      } catch (emailError) {
        // Don't fail the sighting creation if email fails
        console.error('[Sightings] Failed to send dispatcher notifications:', emailError);
      }
    }

    return NextResponse.json(sighting, { status: 201 });
  } catch (error) {
    console.error('[Sightings] Error creating sighting:', error);
    return NextResponse.json(
      { error: 'Failed to create sighting report' },
      { status: 500 }
    );
  }
}

// GET /api/sightings - List sightings (requires authentication - dispatcher/coordinator/admin)
export async function GET(request: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only dispatchers, coordinators, and admins can view sightings
    const allowedRoles = ['DISPATCHER', 'COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    const orgId = await getCurrentOrgId();

    // Build filter conditions with org scoping
    const where: Record<string, unknown> = {
      // Multi-tenant: scope to current org (or null for legacy data)
      OR: orgId
        ? [{ organizationId: orgId }, { organizationId: null }]
        : [{ organizationId: null }],
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    const sightings = await prisma.iceSighting.findMany({
      where,
      include: {
        media: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit ? parseInt(limit, 10) : undefined,
    });

    // Get counts by status for dashboard (scoped to org)
    const counts = await prisma.iceSighting.groupBy({
      by: ['status'],
      where: {
        OR: orgId
          ? [{ organizationId: orgId }, { organizationId: null }]
          : [{ organizationId: null }],
      },
      _count: true,
    });

    const statusCounts = counts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      sightings,
      counts: statusCounts,
      total: sightings.length,
    });
  } catch (error) {
    console.error('[Sightings] Error fetching sightings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sightings' },
      { status: 500 }
    );
  }
}
