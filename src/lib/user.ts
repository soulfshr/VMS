import { prisma } from './db';
import { getCurrentUser } from './auth';
import { getCurrentOrgId } from './org-context';
import type { User, OrganizationMember, UserQualification, QualifiedRole, Organization } from '../generated/prisma/client';

/**
 * Get the database user for the current session.
 * User must exist in database (no auto-creation with NextAuth).
 *
 * MULTI-ORG AWARE: When org context is available, this function overlays
 * the membership role/accountStatus onto the returned user object. This
 * allows existing role checks (user.role) to work correctly with multi-org.
 */
export async function getDbUser(): Promise<User | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const orgId = await getCurrentOrgId();

  // If we have org context, get membership to overlay org-specific data
  if (orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: sessionUser.id,
          organizationId: orgId,
        },
      },
      include: {
        user: true,
      },
    });

    if (membership && membership.isActive) {
      // Return user with membership role/status overlaid
      return {
        ...membership.user,
        role: membership.role,
        accountStatus: membership.accountStatus,
        // These are per-org in membership but we keep them on user for compatibility
        notes: membership.notes ?? membership.user.notes,
        intakeResponses: membership.intakeResponses ?? membership.user.intakeResponses,
      };
    }
  }

  // Fallback: Look up user directly (legacy behavior)
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  return dbUser;
}

/**
 * Get the database user with their zones
 *
 * MULTI-ORG AWARE: When org context is available, overlays membership role.
 */
export async function getDbUserWithZones() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const orgId = await getCurrentOrgId();

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      zones: {
        include: {
          zone: true,
        },
      },
      userQualifications: {
        include: {
          qualifiedRole: true,
        },
      },
    },
  });

  if (!dbUser) return null;

  // If we have org context, overlay membership role/status
  if (orgId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: sessionUser.id,
          organizationId: orgId,
        },
      },
    });

    if (membership && membership.isActive) {
      return {
        ...dbUser,
        role: membership.role,
        accountStatus: membership.accountStatus,
        notes: membership.notes ?? dbUser.notes,
        intakeResponses: membership.intakeResponses ?? dbUser.intakeResponses,
      };
    }
  }

  return dbUser;
}

// Type for the membership context returned by getDbUserMembership
export type MembershipContext = {
  user: User;
  membership: OrganizationMember & {
    organization: Organization;
    userQualifications?: (UserQualification & {
      qualifiedRole: QualifiedRole;
    })[];
  };
};

/**
 * Get the current user's membership for the current organization.
 * This is the primary helper for membership-based authorization.
 *
 * Returns null if:
 * - User is not logged in
 * - User doesn't have a membership in the current org
 * - No org context available
 *
 * For legacy support during migration, falls back to getDbUser() if needed.
 */
export async function getDbUserMembership(): Promise<MembershipContext | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const orgId = await getCurrentOrgId();

  // If no org context, fall back to legacy behavior
  if (!orgId) {
    const user = await getDbUser();
    if (!user) return null;

    // Check if user has any memberships - if so, they need org context
    const hasMemberships = await prisma.organizationMember.count({
      where: { userId: user.id, isActive: true },
    });

    if (hasMemberships > 0) {
      // User has memberships but no org context - this shouldn't happen normally
      // The middleware should have redirected them
      return null;
    }

    // Legacy user without memberships - create a synthetic membership context
    // This allows the migration to proceed gradually
    if (user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: user.organizationId },
      });

      if (org) {
        return {
          user,
          membership: {
            id: 'legacy',
            userId: user.id,
            organizationId: user.organizationId,
            organization: org,
            role: user.role,
            accountStatus: user.accountStatus,
            applicationDate: user.applicationDate,
            approvedById: user.approvedById,
            approvedAt: user.approvedAt,
            rejectionReason: user.rejectionReason,
            intakeResponses: user.intakeResponses,
            notes: user.notes,
            isActive: true,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          } as MembershipContext['membership'],
        };
      }
    }

    return null;
  }

  // Look up membership for current org
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: sessionUser.id,
        organizationId: orgId,
      },
    },
    include: {
      user: true,
      organization: true,
    },
  });

  if (!membership || !membership.isActive) {
    return null;
  }

  return {
    user: membership.user,
    membership,
  };
}

/**
 * Get membership with user qualifications included.
 * Use this when you need to check qualification-based permissions.
 */
export async function getDbUserMembershipWithQualifications(): Promise<MembershipContext | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const orgId = await getCurrentOrgId();
  if (!orgId) return null;

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: sessionUser.id,
        organizationId: orgId,
      },
    },
    include: {
      user: {
        include: {
          userQualifications: {
            include: {
              qualifiedRole: true,
            },
          },
        },
      },
      organization: true,
    },
  });

  if (!membership || !membership.isActive) {
    return null;
  }

  return {
    user: membership.user,
    membership: {
      ...membership,
      userQualifications: membership.user.userQualifications,
    },
  };
}

/**
 * Check if the current user has a specific role in the current org.
 * Convenience helper for role-based authorization.
 */
export async function hasOrgRole(roles: string | string[]): Promise<boolean> {
  const ctx = await getDbUserMembership();
  if (!ctx) return false;

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.includes(ctx.membership.role);
}
