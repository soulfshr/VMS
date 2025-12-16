import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendVerifyEmailAndSetPasswordEmail } from '@/lib/email';
import crypto from 'crypto';
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

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
    });

    if (existingUser) {
      // Return generic error to prevent email enumeration
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in or use forgot password.' },
        { status: 400 }
      );
    }

    // Validate zone selection
    if (!zoneIds || !Array.isArray(zoneIds) || zoneIds.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one zone' },
        { status: 400 }
      );
    }

    // Verify zones exist
    const zones = await prisma.zone.findMany({
      where: { id: { in: zoneIds }, isActive: true },
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

    // Create the user with PENDING status
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        phone: phone?.trim() || null,
        signalHandle: signalHandle?.trim() || null,
        primaryLanguage: primaryLanguage || 'English',
        role: 'VOLUNTEER', // Default role, can be changed by admin during approval
        accountStatus: 'PENDING',
        applicationDate: new Date(),
        isActive: true, // Active but PENDING status controls access
        isVerified: false, // Will be set to true when they set password
        intakeResponses: intakeResponses || {},
        resetToken: hashedToken, // Reuse reset token field for verification
        resetTokenExpiresAt: tokenExpiresAt,
        unsubscribeToken,
        emailNotifications: true,
      },
    });

    // Create zone assignments
    const zoneAssignments = zoneIds.map((zoneId: string) => ({
      userId: user.id,
      zoneId,
      isPrimary: zoneId === primaryZoneId,
    }));

    await prisma.userZone.createMany({
      data: zoneAssignments,
    });

    // Create availability records if provided
    if (availability && typeof availability === 'object') {
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

    // Send verification email with password setup link
    const emailSent = await sendVerifyEmailAndSetPasswordEmail({
      to: normalizedEmail,
      userName: user.name,
      verificationToken, // Send unhashed token
    });

    if (!emailSent) {
      console.error(`[Signup] Failed to send verification email to ${normalizedEmail}`);
      // Don't fail the signup, but log it
    }

    console.log(`[Signup] New application submitted: ${normalizedEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Application submitted. Please check your email to verify your address and set your password.',
    });
  } catch (error) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while submitting your application. Please try again.' },
      { status: 500 }
    );
  }
}
