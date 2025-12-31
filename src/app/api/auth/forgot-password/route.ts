import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Hash a reset token using SHA-256
 * We store the hash in the database and send the unhashed token to the user
 * This way, if the database is compromised, the tokens cannot be used
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  // Rate limiting - stricter for password reset to prevent abuse
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimitAsync(`forgotPassword:${clientIp}`, RATE_LIMITS.forgotPassword);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      // Don't reveal that email is missing
      return NextResponse.json({ success: true });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Also rate limit per email to prevent flooding a specific address
    const emailRateLimit = await checkRateLimitAsync(`forgotPassword-email:${normalizedEmail}`, { limit: 2, windowSeconds: 300 });
    if (!emailRateLimit.success) {
      // Still return success to prevent enumeration
      console.log(`[Auth] Password reset rate limited for email: ${normalizedEmail} (retry after ${emailRateLimit.retryAfter}s)`);
      return NextResponse.json({ success: true });
    }

    // Find user by email (include memberships for branding)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        // Multi-tenant: Get org from memberships, not legacy organizationId
        memberships: {
          where: { accountStatus: 'APPROVED' },
          select: { organizationId: true },
          take: 1,
        },
      },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      console.log(`[Auth] Password reset requested for unknown/inactive email: ${normalizedEmail}`);
      return NextResponse.json({ success: true });
    }

    // Get request origin for multi-tenant URL support
    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || undefined;

    // Generate cryptographically secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before storing in database
    // This ensures that even if the database is compromised, tokens cannot be used
    const hashedToken = hashToken(resetToken);

    // Token expires in 4 hours (more secure than 24 hours)
    const resetTokenExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    // Store HASHED token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiresAt,
      },
    });

    // Send UNHASHED password reset token to user via email
    // Include orgId for branding and origin for multi-tenant URL
    // Multi-tenant: Use first approved membership's org for branding
    const userOrgId = user.memberships[0]?.organizationId;
    const emailSent = await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetToken, // Send the unhashed token
      orgId: userOrgId || undefined,
      origin,
    });

    if (!emailSent) {
      console.error(`[Auth] Failed to send password reset email to ${user.email}`);
      // Still return success to prevent enumeration
    }

    console.log(`[Auth] Password reset token generated for ${user.email}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth] Error in forgot-password:', error);
    // Return success even on error to prevent enumeration
    return NextResponse.json({ success: true });
  }
}
