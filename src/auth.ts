import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { prisma } from '@/lib/db';
import { auditAuth } from '@/lib/audit';
import { headers } from 'next/headers';
import { getOrgSlugFromHost } from '@/lib/org-context';

export const { handlers, auth, signIn, signOut } = NextAuth({
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
            // Multi-org: Only approved memberships should allow access
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

        // Get primary zone name (legacy, will be per-org in future)
        const primaryZone = user.zones[0]?.zone?.name;

        // Build memberships array for the token
        const memberships = user.memberships.map(m => ({
          organizationId: m.organizationId,
          organizationSlug: m.organization.slug,
          organizationName: m.organization.name,
          role: m.role,
          accountStatus: m.accountStatus,
        }));

        // Try to determine current org from request headers
        let currentMembership = memberships[0]; // Default to first membership
        try {
          const headersList = await headers();
          const host = headersList.get('host') || '';
          const orgSlug = getOrgSlugFromHost(host);

          if (orgSlug) {
            const matchingMembership = memberships.find(
              m => m.organizationSlug === orgSlug
            );
            if (matchingMembership) {
              currentMembership = matchingMembership;
            }
          }
        } catch {
          // Headers may not be available in all contexts
        }

        // FALLBACK: If no memberships exist yet, use legacy User fields
        // This supports the transition period before backfill
        if (memberships.length === 0) {
          // Map qualified roles from the new system (slugs like 'VERIFIER', 'ZONE_LEAD', 'DISPATCHER')
          const qualifications = user.userQualifications.map(
            uq => uq.qualifiedRole.slug as 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER'
          );

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role, // Legacy User.role
            zone: primaryZone,
            qualifications,
            accountStatus: user.accountStatus, // Legacy User.accountStatus
            // No currentOrganizationId or memberships
          };
        }

        // Map qualified roles from the new system
        const qualifications = user.userQualifications.map(
          uq => uq.qualifiedRole.slug as 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER'
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Current org context
          currentOrganizationId: currentMembership?.organizationId,
          currentOrganizationSlug: currentMembership?.organizationSlug,
          // Per-org data from current membership
          role: currentMembership?.role || user.role,
          zone: primaryZone,
          qualifications, // TODO: Make per-org
          accountStatus: currentMembership?.accountStatus || user.accountStatus,
          // All memberships for org switcher
          memberships,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign in, add user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email!;
        token.name = user.name!;
        token.currentOrganizationId = user.currentOrganizationId;
        token.currentOrganizationSlug = user.currentOrganizationSlug;
        token.role = user.role;
        token.zone = user.zone;
        token.qualifications = user.qualifications;
        token.accountStatus = user.accountStatus;
        token.memberships = user.memberships;
      }

      // Refresh membership data on every request
      const memberships = token.memberships as Array<{
        organizationId: string;
        organizationSlug: string;
        organizationName: string;
        role: string;
        accountStatus: string;
      }> | undefined;

      if (token.id && memberships && memberships.length > 0) {
        try {
          // Determine current org from request headers
          const headersList = await headers();
          const host = headersList.get('host') || '';
          const orgSlug = getOrgSlugFromHost(host);

          if (orgSlug) {
            // Find membership matching current subdomain
            const currentMembership = memberships.find(
              m => m.organizationSlug === orgSlug
            );

            if (currentMembership) {
              // Refresh membership data from database
              const freshMembership = await prisma.organizationMember.findUnique({
                where: {
                  userId_organizationId: {
                    userId: token.id as string,
                    organizationId: currentMembership.organizationId,
                  },
                },
                select: {
                  role: true,
                  accountStatus: true,
                  isActive: true,
                },
              });

              if (freshMembership && freshMembership.isActive) {
                token.currentOrganizationId = currentMembership.organizationId;
                token.currentOrganizationSlug = currentMembership.organizationSlug;
                token.role = freshMembership.role;
                token.accountStatus = freshMembership.accountStatus;
              } else if (freshMembership && !freshMembership.isActive) {
                // Membership has been deactivated - clear org context
                token.currentOrganizationId = undefined;
                token.currentOrganizationSlug = undefined;
              }
            } else {
              // User is not a member of this org - clear org context
              // The middleware will handle redirecting to request-access page
              token.currentOrganizationId = undefined;
              token.currentOrganizationSlug = undefined;
            }
          }
        } catch (error) {
          console.error('Error refreshing membership data:', error);
        }
      } else if (token.id) {
        // FALLBACK: No memberships, use legacy User fields
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { accountStatus: true, isActive: true, role: true },
          });
          if (dbUser) {
            token.accountStatus = dbUser.accountStatus;
            token.role = dbUser.role;
            // Also check if user has been deactivated
            if (!dbUser.isActive) {
              // Return empty token to force re-authentication
              return {};
            }
          }
        } catch (error) {
          console.error('Error refreshing accountStatus:', error);
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
        session.user.currentOrganizationId = token.currentOrganizationId as string | undefined;
        session.user.currentOrganizationSlug = token.currentOrganizationSlug as string | undefined;
        session.user.role = token.role as 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
        session.user.zone = token.zone as string | undefined;
        session.user.qualifications = (token.qualifications || []) as ('VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER')[];
        session.user.accountStatus = token.accountStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
        session.user.memberships = token.memberships as Array<{
          organizationId: string;
          organizationSlug: string;
          organizationName: string;
          role: 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';
          accountStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
        }> | undefined;
      }
      return session;
    },
  },
});
