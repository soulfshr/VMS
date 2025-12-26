/**
 * Organization Context Helper
 *
 * This module provides utilities for multi-tenant organization context:
 * - Reading organization from session (currentOrgId)
 * - Scoping database queries to current organization
 */

import { auth } from '@/auth';
import { prisma } from './db';

// Cache for organization lookups (simple in-memory cache)
const orgCache = new Map<string, { org: Awaited<ReturnType<typeof prisma.organization.findFirst>> | null; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Reserved slugs that cannot be used as organization subdomains
 */
export const RESERVED_SLUGS = [
  'app', 'www', 'api', 'admin', 'support', 'help',
  'mail', 'email', 'staging',
  'localhost', 'static', 'assets', 'cdn'
];

/**
 * Get organization by ID with caching
 */
export async function getOrganizationById(id: string) {
  const cacheKey = `id:${id}`;
  const cached = orgCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.org;
  }

  const org = await prisma.organization.findFirst({
    where: {
      id,
      isActive: true
    },
    include: {
      settings: true,
    },
  });

  orgCache.set(cacheKey, { org, expires: Date.now() + CACHE_TTL });

  return org;
}

/**
 * Get organization by slug with caching
 */
export async function getOrganizationBySlug(slug: string) {
  const cacheKey = `slug:${slug}`;
  const cached = orgCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.org;
  }

  const org = await prisma.organization.findFirst({
    where: {
      slug: slug.toLowerCase(),
      isActive: true
    },
    include: {
      settings: true,
    },
  });

  orgCache.set(cacheKey, { org, expires: Date.now() + CACHE_TTL });

  return org;
}

/**
 * Get the current organization from the session
 * Returns the organization for the user's currently selected org
 *
 * @returns Organization with settings, or null if not found/not selected
 */
export async function getCurrentOrganization() {
  const session = await auth();
  const currentOrgId = session?.user?.currentOrgId;

  if (!currentOrgId) {
    return null;
  }

  return getOrganizationById(currentOrgId);
}

/**
 * Get the current organization ID from session
 * This is the primary way to get org context in the new architecture
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.currentOrgId ?? null;
}

/**
 * Get the current organization slug from session
 * Derives slug from memberships array + currentOrgId
 */
export async function getCurrentOrgSlug(): Promise<string | null> {
  const session = await auth();
  const currentOrgId = session?.user?.currentOrgId;

  if (!currentOrgId) {
    return null;
  }

  const membership = session?.user?.memberships?.find(
    m => m.organizationId === currentOrgId
  );

  return membership?.organizationSlug ?? null;
}

/**
 * Create a Prisma where clause that scopes to the current organization
 * Requires org context - returns empty object if no org selected
 *
 * @example
 * const users = await prisma.user.findMany({
 *   where: {
 *     ...await orgScope(),
 *     isActive: true,
 *   }
 * });
 */
export async function orgScope(): Promise<{ organizationId: string } | Record<string, never>> {
  const orgId = await getCurrentOrgId();

  if (orgId) {
    return { organizationId: orgId };
  }

  // No org context: return empty (will match all - should be rare with new architecture)
  return {};
}

/**
 * Get the organizationId to use when creating new records
 * Returns the current org ID or undefined if not selected
 */
export async function getOrgIdForCreate(): Promise<string | undefined> {
  const orgId = await getCurrentOrgId();
  return orgId ?? undefined;
}

/**
 * Clear the organization cache (useful for testing or after org updates)
 */
export function clearOrgCache(): void {
  orgCache.clear();
}

/**
 * Validate organization slug format
 * Slug must be: lowercase alphanumeric + hyphens, 2-30 chars
 */
export function isValidOrgSlug(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 30) {
    return false;
  }

  // Must be lowercase alphanumeric with hyphens (no leading/trailing hyphens)
  const validPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{2}$/;
  if (!validPattern.test(slug)) {
    return false;
  }

  // Check reserved slugs
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return false;
  }

  return true;
}
