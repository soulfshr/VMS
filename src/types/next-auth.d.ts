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

      // Current organization context (from subdomain at login)
      currentOrganizationId?: string;
      currentOrganizationSlug?: string;

      // Per-org data (from OrganizationMember for current org)
      role: Role;
      zone?: string;
      qualifications: Qualification[];
      accountStatus?: AccountStatus;

      // All memberships (for org switcher UI)
      memberships?: OrgMembership[];
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;

    // Current organization context
    currentOrganizationId?: string;
    currentOrganizationSlug?: string;

    // Per-org data
    role: Role;
    zone?: string;
    qualifications: Qualification[];
    accountStatus?: AccountStatus;

    // All memberships
    memberships?: OrgMembership[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;

    // Current organization context
    currentOrganizationId?: string;
    currentOrganizationSlug?: string;

    // Per-org data
    role: Role;
    zone?: string;
    qualifications: Qualification[];
    accountStatus?: AccountStatus;

    // All memberships
    memberships?: OrgMembership[];
  }
}
