import 'next-auth';
import type { Role, Qualification, AccountStatus } from '@/generated/prisma/client';

// Membership info for org switcher UI
interface OrgMembership {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: Role;
  accountStatus: AccountStatus;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;

      // Currently selected organization (stored in session, not from subdomain)
      currentOrgId: string | null;

      // Per-org data (derived from currentOrgId + memberships)
      role: Role;
      zone?: string;
      qualifications: Qualification[];
      accountStatus?: AccountStatus;

      // All memberships (for org switcher and role lookup)
      memberships: OrgMembership[];
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;

    // Currently selected organization
    currentOrgId: string | null;

    // Per-org data
    role: Role;
    zone?: string;
    qualifications: Qualification[];
    accountStatus?: AccountStatus;

    // All memberships
    memberships: OrgMembership[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;

    // Currently selected organization
    currentOrgId: string | null;

    // Per-org data
    role: Role;
    zone?: string;
    qualifications: Qualification[];
    accountStatus?: AccountStatus;

    // All memberships
    memberships: OrgMembership[];
  }
}
