import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDbUser } from '@/lib/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/developer/organizations/[id]/users
 *
 * List all users in an organization
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden - Developer access required' }, { status: 403 });
    }

    const { id: orgId } = await params;

    // Handle special case for orphaned users (no org)
    const whereClause = orgId === '__none__'
      ? { organizationId: null }
      : { organizationId: orgId };

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        organizationId: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get org info if not orphaned
    let organization = null;
    if (orgId !== '__none__') {
      organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, slug: true },
      });

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
    }

    return NextResponse.json({
      organization,
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Error fetching organization users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * POST /api/developer/organizations/[id]/users
 *
 * Add a user to an organization
 * Body: { userId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden - Developer access required' }, { status: 403 });
    }

    const { id: orgId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify org exists (unless __none__)
    if (orgId !== '__none__') {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
    }

    // Verify user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user's organization
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: orgId === '__none__' ? null : orgId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error adding user to organization:', error);
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
}

/**
 * DELETE /api/developer/organizations/[id]/users
 *
 * Remove a user from an organization (sets organizationId to null)
 * Body: { userId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getDbUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'Forbidden - Developer access required' }, { status: 403 });
    }

    const { id: orgId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify user exists and belongs to this org
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For __none__, we're moving orphaned users somewhere else
    // For regular orgs, verify user belongs to this org
    if (orgId !== '__none__' && targetUser.organizationId !== orgId) {
      return NextResponse.json({ error: 'User does not belong to this organization' }, { status: 400 });
    }

    // Remove user from organization (set to null)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error removing user from organization:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
