import { prisma } from './db';
import { getCurrentUser } from './auth';
import type { User } from '../generated/prisma/client';

/**
 * Get the database user for the current session.
 * Bridges dev auth (which uses hardcoded users) with the database.
 * Creates the user if they don't exist yet.
 */
export async function getDbUser(): Promise<User | null> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  // Look up user by email in database
  let dbUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
  });

  // If user doesn't exist in DB, create them
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email: sessionUser.email,
        name: sessionUser.name,
        phone: sessionUser.phone || null,
        role: sessionUser.role,
        primaryLanguage: sessionUser.primaryLanguage || 'English',
      },
    });
  }

  return dbUser;
}

/**
 * Get the database user with their zones
 */
export async function getDbUserWithZones() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  let dbUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    include: {
      zones: {
        include: {
          zone: true,
        },
      },
    },
  });

  // If user doesn't exist, create them and assign their zone if specified
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email: sessionUser.email,
        name: sessionUser.name,
        phone: sessionUser.phone || null,
        role: sessionUser.role,
        primaryLanguage: sessionUser.primaryLanguage || 'English',
        ...(sessionUser.zone && {
          zones: {
            create: {
              zone: {
                connect: {
                  name: sessionUser.zone,
                },
              },
              isPrimary: true,
            },
          },
        }),
      },
      include: {
        zones: {
          include: {
            zone: true,
          },
        },
      },
    });
  }

  return dbUser;
}
