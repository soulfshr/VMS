import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/email-blast/[id] - Get email blast details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const blast = await prisma.emailBlast.findUnique({
      where: { id },
      include: {
        sentBy: {
          select: {
            name: true,
            email: true,
          },
        },
        recipients: {
          select: {
            id: true,
            email: true,
            status: true,
            sentAt: true,
            error: true,
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!blast) {
      return NextResponse.json({ error: 'Email blast not found' }, { status: 404 });
    }

    return NextResponse.json(blast);
  } catch (error) {
    console.error('Error fetching email blast:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email blast' },
      { status: 500 }
    );
  }
}
