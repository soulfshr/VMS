import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { validatePassword } from '@/lib/password';
import { sendNewApplicationNotification } from '@/lib/email';

/**
 * Hash a reset token using SHA-256
 * The database stores hashed tokens, so we hash the incoming token to compare
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimitAsync(`resetPassword:${clientIp}`, RATE_LIMITS.resetPassword);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0], errors: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Hash the incoming token to match against stored hash
    const hashedToken = hashToken(token);

    // Find user by hashed reset token
    const user = await prisma.user.findUnique({
      where: { resetToken: hashedToken },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if this is a new signup verification (PENDING user setting password for first time)
    const isNewSignupVerification = user.accountStatus === 'PENDING' && !user.isVerified;

    // Update user with new password and clear reset token
    // Also set isVerified: true if this is a new signup verification
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordSetAt: new Date(),
        resetToken: null,
        resetTokenExpiresAt: null,
        ...(isNewSignupVerification && { isVerified: true }),
      },
    });

    // If this is a new signup, notify coordinators/admins
    if (isNewSignupVerification) {
      console.log(`[Auth] New signup verified: ${user.email}`);

      // Send notification to coordinators and admins (fire and forget)
      sendNewApplicationNotification({
        applicantName: user.name,
        applicantEmail: user.email,
      }).catch(err => {
        console.error('[Auth] Failed to send new application notification:', err);
      });
    }

    console.log(`[Auth] Password ${isNewSignupVerification ? 'set' : 'reset'} successful for ${user.email}`);
    return NextResponse.json({ success: true, isNewSignup: isNewSignupVerification });
  } catch (error) {
    console.error('[Auth] Error in reset-password:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
