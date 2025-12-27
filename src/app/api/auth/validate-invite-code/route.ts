import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/auth/validate-invite-code - Validate an invite code and return org info
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const trimmed = code.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
      return NextResponse.json({ error: 'Invalid invite code format' }, { status: 400 });
    }

    // Look up the organization by invite code (case-insensitive)
    const settings = await prisma.organizationSettings.findFirst({
      where: {
        inviteCode: {
          equals: trimmed,
          mode: 'insensitive',
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!settings || !settings.organization) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Return organization info
    return NextResponse.json({
      valid: true,
      organization: {
        id: settings.organization.id,
        name: settings.organization.name,
        slug: settings.organization.slug,
      },
    });
  } catch (error) {
    console.error('Error validating invite code:', error);
    return NextResponse.json({ error: 'Failed to validate invite code' }, { status: 500 });
  }
}
