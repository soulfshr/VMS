import { NextRequest, NextResponse } from 'next/server';
import { sendFeedbackEmail } from '@/lib/email';
import { getDbUser } from '@/lib/user';

// POST /api/feedback - Submit user feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, message, url, userAgent } = body;

    // Validate required fields
    if (!category || !message) {
      return NextResponse.json(
        { error: 'Category and message are required' },
        { status: 400 }
      );
    }

    // Try to get the current user (feedback works for both logged-in and anonymous users)
    let userEmail: string | undefined;
    let userName: string | undefined;

    try {
      const user = await getDbUser();
      if (user) {
        userEmail = user.email;
        userName = user.name;
      }
    } catch {
      // User not logged in - that's fine, continue without user info
    }

    // Send the feedback email
    await sendFeedbackEmail({
      category,
      message,
      userEmail,
      userName,
      url,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
