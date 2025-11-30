import { cookies } from 'next/headers';
import { DevUser, DEV_USERS, getDevUserById, AuthSession } from '@/types/auth';

const AUTH_COOKIE_NAME = 'siembra-vms-auth';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Server-side: Get current session from cookies
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME);

  if (!authCookie?.value) {
    return null;
  }

  try {
    const session: AuthSession = JSON.parse(authCookie.value);

    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

// Server-side: Get current user from session
export async function getCurrentUser(): Promise<DevUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

// Server-side: Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

// Server-side: Check if user has required role
export async function hasRole(requiredRoles: DevUser['role'][]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return requiredRoles.includes(user.role);
}

// Create session data for a user
export function createSessionData(userId: string): AuthSession | null {
  const user = getDevUserById(userId);
  if (!user) return null;

  return {
    user,
    expiresAt: Date.now() + SESSION_DURATION,
  };
}

// Get all dev users (for login page)
export function getAllDevUsers(): DevUser[] {
  return DEV_USERS;
}

// Group users by role for display
export function getDevUsersByRoleGrouped(): Record<string, DevUser[]> {
  return {
    Administrator: DEV_USERS.filter(u => u.role === 'ADMINISTRATOR'),
    Coordinator: DEV_USERS.filter(u => u.role === 'COORDINATOR'),
    Dispatcher: DEV_USERS.filter(u => u.role === 'DISPATCHER'),
    Volunteer: DEV_USERS.filter(u => u.role === 'VOLUNTEER'),
  };
}
