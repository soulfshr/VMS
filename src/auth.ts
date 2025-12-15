import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { prisma } from '@/lib/db';
import { auditAuth } from '@/lib/audit';

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

        // Find user by email
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
        auditAuth(
          { id: user.id, email: user.email, name: user.name },
          'LOGIN'
        );

        // Get primary zone name
        const primaryZone = user.zones[0]?.zone?.name;

        // Map qualified roles from the new system (slugs like 'VERIFIER', 'ZONE_LEAD', 'DISPATCHER')
        const qualifications = user.userQualifications.map(
          uq => uq.qualifiedRole.slug as 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER'
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          zone: primaryZone,
          qualifications,
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
        token.role = user.role;
        token.zone = user.zone;
        token.qualifications = user.qualifications;
      }
      return token;
    },
    async session({ session, token }) {
      // Mutate existing session.user to avoid AdapterUser type conflicts
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR';
        session.user.zone = token.zone as string | undefined;
        session.user.qualifications = (token.qualifications || []) as ('VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER')[];
      }
      return session;
    },
  },
});
