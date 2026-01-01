import { prisma } from './db';
import { getCurrentUser } from './auth';
import { getCurrentOrgId } from './org-context';
import type { User, OrganizationMember, UserQualification, QualifiedRole, Organization } from '../generated/prisma/client';

/**
 * Get the database user for the current session.
 * User must exist in database (no auto-creation with NextAuth).
 *
 * MULTI-ORG AWARE: Overlays the session's role/accountStatus onto the
 * returned user object. The session already contains org-specific role
 * from the selected organization's membership.
 */
export async function getDbUser(): Promise<User | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  // Get the base user from the database
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  if (!dbUser) return null;

  // Overlay session's org-specific role (already set by auth from selected org's membership)
  if (sessionUser.currentOrgId && sessionUser.role) {
    return {
      ...dbUser,
      role: sessionUser.role,
      accountStatus: sessionUser.accountStatus || dbUser.accountStatus,
    };
  }

  return dbUser;
}

/**
 * Get the database user with their zones
 *
 * MULTI-ORG AWARE: Overlays session's org-specific role.
 * Filters qualifications to only include those from the current org.
 */
export async function getDbUserWithZones() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const orgId = await getCurrentOrgId();

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      zones: {
        // Filter to only include zones from current org
        where: orgId ? {
          zone: {
            organizationId: orgId,
          },
        } : {},
        include: {
          zone: true,
        },
      },
      userQualifications: {
        // Filter to only include qualifications from current org
        where: orgId ? {
          qualifiedRole: {
            organizationId: orgId,
          },
        } : {},
        include: {
          qualifiedRole: true,
        },
      },
    },
  });

  if (!dbUser) return null;

  // Overlay session's org-specific role
  if (sessionUser.currentOrgId && sessionUser.role) {
    return {
      ...dbUser,
      role: sessionUser.role,
      accountStatus: sessionUser.accountStatus || dbUser.accountStatus,
    };
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
 * - No org context available (user hasn't selected an org)
 */
export async function getDbUserMembership(): Promise<MembershipContext | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const orgId = await getCurrentOrgId();
  if (!orgId) return null;

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
