import { auth } from '@/auth';
import type { Session } from 'next-auth';

// Server-side: Get current session using NextAuth
export async function getSession(): Promise<Session | null> {
  return await auth();
}

// Server-side: Get current user from session
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// Server-side: Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

// Server-side: Check if user has required role
export async function hasRole(requiredRoles: string[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return requiredRoles.includes(user.role);
}
