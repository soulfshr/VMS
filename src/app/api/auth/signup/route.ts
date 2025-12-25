import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendVerifyEmailAndSetPasswordEmail } from '@/lib/email';
import crypto from 'crypto';
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { getOrgIdForCreate } from '@/lib/org-context';

/**
 * Hash a reset token using SHA-256
 * We store the hash in the database and send the unhashed token to the user
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Rate limit for signup: 5 per hour per IP
const SIGNUP_RATE_LIMIT = { limit: 5, windowSeconds: 3600 };

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimitAsync(`signup:${clientIp}`, SIGNUP_RATE_LIMIT);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    // Get organization context for multi-tenant support
    const orgId = await getOrgIdForCreate();

    const body = await request.json();
    const {
      name,
      email,
      phone,
      signalHandle,
      primaryLanguage,
      zoneIds,
      primaryZoneId,
      availability,
      intakeResponses,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: orgId ? {
          where: { organizationId: orgId }
        } : undefined
      }
    });

    // Validate zone selection
    if (!zoneIds || !Array.isArray(zoneIds) || zoneIds.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one zone' },
        { status: 400 }
      );
    }

    // Verify zones exist and belong to the current organization
    const zones = await prisma.zone.findMany({
      where: {
        id: { in: zoneIds },
        isActive: true,
        // Multi-tenant: scope to current org (or null for legacy data)
        OR: orgId
          ? [{ organizationId: orgId }, { organizationId: null }]
          : [{ organizationId: null }],
      },
    });

    if (zones.length !== zoneIds.length) {
      return NextResponse.json(
        { error: 'One or more selected zones are invalid' },
        { status: 400 }
      );
    }

    // Generate verification/password setup token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(verificationToken);

    // Token expires in 48 hours (longer than password reset since it's new account)
    const tokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Generate unsubscribe token
    const unsubscribeToken = crypto.randomBytes(16).toString('hex');

    let user;
    let isExistingUser = false;

    if (existingUser) {
      // User exists - check if they already have a membership in this org
      if (orgId && existingUser.memberships && existingUser.memberships.length > 0) {
        // Already has membership in this org
        return NextResponse.json(
          { error: 'An account with this email already exists in this organization. Please sign in or use forgot password.' },
          { status: 400 }
        );
      }

      // User exists but no membership in this org - create membership
      // This allows existing users to join new organizations
      isExistingUser = true;
      user = existingUser;

      // Update user profile if they don't have complete info
      if (!user.phone && phone?.trim()) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            phone: phone.trim(),
            signalHandle: signalHandle?.trim() || user.signalHandle,
          }
        });
      }

      // Create membership for this org
      if (orgId) {
        await prisma.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            role: 'VOLUNTEER',
            accountStatus: 'PENDING',
            applicationDate: new Date(),
            intakeResponses: intakeResponses || {},
            isActive: true,
          }
        });
      }

      console.log(`[Signup] Existing user ${normalizedEmail} applying to new org`);
    } else {
      // New user - create user and membership
      user = await prisma.user.create({
        data: {
          // DEPRECATED: Keep organizationId for backward compatibility
          organizationId: orgId,
          email: normalizedEmail,
          name: name.trim(),
          phone: phone?.trim() || null,
          signalHandle: signalHandle?.trim() || null,
          primaryLanguage: primaryLanguage || 'English',
          // DEPRECATED: Keep role/accountStatus on User for backward compatibility
          role: 'VOLUNTEER',
          accountStatus: 'PENDING',
          applicationDate: new Date(),
          isActive: true,
          isVerified: false,
          intakeResponses: intakeResponses || {},
          resetToken: hashedToken,
          resetTokenExpiresAt: tokenExpiresAt,
          unsubscribeToken,
          emailNotifications: true,
        },
      });

      // Create membership for this org (the new way)
      if (orgId) {
        await prisma.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            role: 'VOLUNTEER',
            accountStatus: 'PENDING',
            applicationDate: new Date(),
            intakeResponses: intakeResponses || {},
            isActive: true,
          }
        });
      }

      console.log(`[Signup] New user ${normalizedEmail} created`);
    }

    // Create zone assignments
    const zoneAssignments = zoneIds.map((zoneId: string) => ({
      userId: user.id,
      zoneId,
      isPrimary: zoneId === primaryZoneId,
    }));

    // For existing users, skip zones they're already assigned to
    if (isExistingUser) {
      const existingZones = await prisma.userZone.findMany({
        where: { userId: user.id },
        select: { zoneId: true }
      });
      const existingZoneIds = new Set(existingZones.map(z => z.zoneId));
      const newZoneAssignments = zoneAssignments.filter(
        (za: { zoneId: string }) => !existingZoneIds.has(za.zoneId)
      );
      if (newZoneAssignments.length > 0) {
        await prisma.userZone.createMany({
          data: newZoneAssignments,
        });
      }
    } else {
      await prisma.userZone.createMany({
        data: zoneAssignments,
      });
    }

    // Create availability records if provided (only for new users)
    if (!isExistingUser && availability && typeof availability === 'object') {
      const dayMap: { [key: string]: number } = {
        'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0,
      };

      const timeMap: { [key: string]: { start: string; end: string } } = {
        'MORNING': { start: '06:00', end: '10:00' },
        'MIDDAY': { start: '10:00', end: '14:00' },
        'AFTERNOON': { start: '14:00', end: '18:00' },
      };

      const availabilityRecords = [];
      for (const [key, value] of Object.entries(availability)) {
        if (value === true) {
          const [day, slot] = key.split('-');
          const dayOfWeek = dayMap[day];
          const times = timeMap[slot];
          if (dayOfWeek !== undefined && times) {
            availabilityRecords.push({
              userId: user.id,
              dayOfWeek,
              startTime: times.start,
              endTime: times.end,
            });
          }
        }
      }

      if (availabilityRecords.length > 0) {
        await prisma.availability.createMany({
          data: availabilityRecords,
        });
      }
    }

    // Send verification email with password setup link (only for new users)
    // Get request origin for multi-tenant URL support
    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || undefined;

    if (!isExistingUser) {
      const emailSent = await sendVerifyEmailAndSetPasswordEmail({
        to: normalizedEmail,
        userName: user.name,
        verificationToken,
        orgId: orgId || undefined,
        origin,
      });

      if (!emailSent) {
        console.error(`[Signup] Failed to send verification email to ${normalizedEmail}`);
      }

      return NextResponse.json({
        success: true,
        message: 'Application submitted. Please check your email to verify your address and set your password.',
      });
    } else {
      // Existing user joining new org - they can just log in
      return NextResponse.json({
        success: true,
        message: 'Application submitted. Your request to join this organization is pending approval. You can log in with your existing credentials.',
      });
    }
  } catch (error) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while submitting your application. Please try again.' },
      { status: 500 }
    );
  }
}
