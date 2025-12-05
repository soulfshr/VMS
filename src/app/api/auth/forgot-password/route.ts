import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      // Don't reveal that email is missing
      return NextResponse.json({ success: true });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      console.log(`[Auth] Password reset requested for unknown/inactive email: ${normalizedEmail}`);
      return NextResponse.json({ success: true });
    }

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiresAt,
      },
    });

    // Send password reset email
    const emailSent = await sendPasswordResetEmail({
      to: user.email,
      userName: user.name,
      resetToken,
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
