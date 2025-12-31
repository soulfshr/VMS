import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { prisma } from '@/lib/db';
import { auditAuth } from '@/lib/audit';

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email with all their memberships
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            zones: {
              where: { isPrimary: true },
              include: { zone: true },
              take: 1,
            },
            userQualifications: {
              include: {
                qualifiedRole: {
                  select: {
                    slug: true,
                  },
                },
              },
            },
            // Include all APPROVED organization memberships for the user
            memberships: {
              where: {
                isActive: true,
                accountStatus: 'APPROVED',
              },
              include: {
                organization: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        // Check if user is active
        if (!user.isActive) {
          return null;
        }

        // Check if user has a password set
        if (!user.passwordHash) {
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Update last login timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // Audit log the login
        await auditAuth(
          { id: user.id, email: user.email, name: user.name },
          'LOGIN'
        );

        // Get primary zone name
        const primaryZone = user.zones[0]?.zone?.name;

        // Build memberships array for the token
        let memberships = user.memberships.map(m => ({
          organizationId: m.organizationId,
          organizationSlug: m.organization.slug,
          organizationName: m.organization.name,
          role: m.role,
          accountStatus: m.accountStatus,
        }));

        // DEVELOPER role: Grant access to ALL organizations
        // This allows developers to switch between any org for setup/debugging
        if (user.role === 'DEVELOPER') {
          const allOrgs = await prisma.organization.findMany({
            where: { isActive: true },
            select: { id: true, slug: true, name: true },
            orderBy: { name: 'asc' },
          });

          // Create virtual memberships for all orgs (DEVELOPER role, APPROVED status)
          memberships = allOrgs.map(org => ({
            organizationId: org.id,
            organizationSlug: org.slug,
            organizationName: org.name,
            role: 'DEVELOPER' as const,
            accountStatus: 'APPROVED' as const,
          }));
        }

        // Map qualified roles
        const qualifications = user.userQualifications.map(
          uq => uq.qualifiedRole.slug as 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER'
        );

        // Auto-select org logic:
        // 1. If user has exactly 1 membership, auto-select it
        // 2. If user has multiple memberships, try to restore last selected org from cookie
        // 3. Otherwise, leave null - user will need to select
        let autoSelectedOrg = memberships.length === 1 ? memberships[0] : null;

        // For users with multiple memberships, try to restore last selected org
        if (!autoSelectedOrg && memberships.length > 1) {
          try {
            const { cookies } = await import('next/headers');
            const cookieStore = await cookies();
            const lastOrgId = cookieStore.get('last-org-id')?.value;

            if (lastOrgId) {
              // Find the membership for this org (must be APPROVED)
              const lastOrg = memberships.find(
                m => m.organizationId === lastOrgId && m.accountStatus === 'APPROVED'
              );
              if (lastOrg) {
                autoSelectedOrg = lastOrg;
              }
            }
          } catch {
            // Cookie read may fail in some contexts, ignore
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Auto-select org if single membership, otherwise null (user picks)
          currentOrgId: autoSelectedOrg?.organizationId ?? null,
          // Per-org data from auto-selected or first membership (for initial role)
          role: autoSelectedOrg?.role ?? memberships[0]?.role ?? user.role,
          zone: primaryZone,
          qualifications,
          accountStatus: autoSelectedOrg?.accountStatus ?? memberships[0]?.accountStatus ?? user.accountStatus,
          // All memberships for org switcher
          memberships,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On initial sign in, add user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email!;
        token.name = user.name!;
        token.currentOrgId = user.currentOrgId;
        token.role = user.role;
        token.zone = user.zone;
        token.qualifications = user.qualifications;
        token.accountStatus = user.accountStatus;
        token.memberships = user.memberships;
      }

      // Handle explicit org selection via update() from /api/auth/set-org
      if (trigger === 'update' && session?.currentOrgId !== undefined) {
        const memberships = token.memberships as Array<{
          organizationId: string;
          organizationSlug: string;
          organizationName: string;
          role: string;
          accountStatus: string;
        }>;

        // Find the membership for the selected org
        const selectedMembership = memberships?.find(
          m => m.organizationId === session.currentOrgId
        );

        if (selectedMembership) {
          token.currentOrgId = session.currentOrgId;
          token.role = selectedMembership.role;
          token.accountStatus = selectedMembership.accountStatus;
        } else if (session.currentOrgId === null) {
          // Explicitly clearing org (e.g., for org picker)
          token.currentOrgId = null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Mutate existing session.user to avoid AdapterUser type conflicts
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.currentOrgId = (token.currentOrgId as string | null) ?? null;
        session.user.role = token.role as 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
        session.user.zone = token.zone as string | undefined;
        session.user.qualifications = (token.qualifications || []) as ('VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER')[];
        session.user.accountStatus = token.accountStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
        session.user.memberships = (token.memberships || []) as Array<{
          organizationId: string;
          organizationSlug: string;
          organizationName: string;
          role: 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
          accountStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
        }>;
      }
      return session;
    },
  },
});
