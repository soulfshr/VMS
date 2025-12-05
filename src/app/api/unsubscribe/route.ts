import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/unsubscribe?token=xxx
 * One-click unsubscribe handler for email compliance
 * Also supports POST for List-Unsubscribe-Post header
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/profile', request.url));
  }

  try {
    // Find user by unsubscribe token
    const user = await prisma.user.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!user) {
      // Invalid token - redirect to profile page
      return NextResponse.redirect(new URL('/profile?error=invalid_token', request.url));
    }

    // Disable email notifications
    await prisma.user.update({
      where: { id: user.id },
      data: { emailNotifications: false },
    });

    // Return a simple confirmation page
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed - RippleVMS</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f9fafb;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          h1 { color: #0d9488; margin-bottom: 16px; }
          p { color: #6b7280; line-height: 1.6; }
          .resubscribe {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #0d9488;
            color: white;
            text-decoration: none;
            border-radius: 8px;
          }
          .resubscribe:hover { background: #0f766e; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Unsubscribed</h1>
          <p>You have been unsubscribed from RippleVMS email notifications.</p>
          <p>You will no longer receive shift updates, confirmations, or sighting alerts.</p>
          <a href="/profile" class="resubscribe">Manage Preferences</a>
        </div>
      </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.redirect(new URL('/profile?error=failed', request.url));
  }
}

/**
 * POST /api/unsubscribe
 * Handles RFC 8058 List-Unsubscribe-Post one-click unsubscribe
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailNotifications: false },
    });

    return NextResponse.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
