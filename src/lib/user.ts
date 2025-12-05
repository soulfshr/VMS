import { prisma } from './db';
import { getCurrentUser } from './auth';
import type { User } from '../generated/prisma/client';

/**
 * Get the database user for the current session.
 * User must exist in database (no auto-creation with NextAuth).
 */
export async function getDbUser(): Promise<User | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  // Look up user by ID in database (session contains user ID from NextAuth)
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  return dbUser;
}

/**
 * Get the database user with their zones
 */
export async function getDbUserWithZones() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

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

  return dbUser;
}
