/**
 * Organization Context Helper
 *
 * This module provides utilities for multi-tenant organization context:
 * - Reading organization from middleware-injected headers
 * - Scoping database queries to current organization
 * - Fallback to default org during migration period
 */

import { headers, cookies } from 'next/headers';
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
 * Extract organization slug from the request hostname
 * Used as fallback when middleware header is not available
 *
 * Examples:
 * - nc.ripple-vms.com -> 'nc' (production)
 * - awclo.ripple-vms.com -> 'awclo' (production)
 * - nc.dev.ripple-vms.com -> 'nc' (dev environment)
 * - awclo.dev.ripple-vms.com -> 'awclo' (dev environment)
 * - ripple-vms.com -> null (root domain)
 * - localhost:3000 -> null (development)
 */
export function getOrgSlugFromHost(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];

  // Development: localhost doesn't have subdomains
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // Check for subdomain pattern
  const parts = hostname.split('.');

  // Dev environment pattern: [slug].dev.ripple-vms.com (4 parts)
  // e.g., nc.dev.ripple-vms.com -> ['nc', 'dev', 'ripple-vms', 'com']
  if (parts.length === 4 && parts[1] === 'dev') {
    const slug = parts[0];
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      return null;
    }
    return slug.toLowerCase();
  }

  // Production pattern: [slug].ripple-vms.com (3 parts)
  // e.g., nc.ripple-vms.com -> ['nc', 'ripple-vms', 'com']
  if (parts.length === 3) {
    const slug = parts[0];
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      return null;
    }
    return slug.toLowerCase();
  }

  // No valid subdomain pattern found
  return null;
}

/**
 * Get the organization slug from the current request
 * Reads from x-org-slug header set by middleware, with fallback to host parsing
 */
export async function getOrgSlugFromRequest(): Promise<string | null> {
  const headersList = await headers();

  // Primary: read from middleware-injected header
  const orgSlug = headersList.get('x-org-slug');
  if (orgSlug) {
    return orgSlug;
  }

  // Fallback: parse from host header (for non-middleware contexts)
  const host = headersList.get('host') || '';
  return getOrgSlugFromHost(host);
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
 * Get the default organization (for migration period)
 * Returns the first active organization, or null if none exist
 */
export async function getDefaultOrganization() {
  const cacheKey = 'default';
  const cached = orgCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.org;
  }

  // During migration, get the first (and likely only) organization
  const org = await prisma.organization.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      settings: true,
    },
  });

  orgCache.set(cacheKey, { org, expires: Date.now() + CACHE_TTL });

  return org;
}

/**
 * Get the current organization from the request context
 *
 * Subdomain routing:
 * - If subdomain detected and org exists: return that org
 * - If subdomain detected but org NOT found: return null (NOT fallback!)
 * - If no subdomain (localhost/root domain): fallback to default org
 *
 * @returns Organization with settings, or null if not found
 */
export async function getCurrentOrganization() {
  const slug = await getOrgSlugFromRequest();

  if (slug) {
    const org = await getOrganizationBySlug(slug);
    // If subdomain was specified but org not found, return null
    // This prevents showing default org data on non-existent subdomain
    return org; // may be null if org doesn't exist
  }

  // Only fallback to default org when NO subdomain (localhost/root domain)
  return getDefaultOrganization();
}

// Special symbol to indicate "viewing orphaned records only"
const ORPHANED_RECORDS = '__none__' as const;

/**
 * Get the current organization ID for query scoping
 * Returns undefined for backward compatibility when no org context exists
 * Returns '__none__' when developer explicitly wants to view orphaned records
 *
 * For DEVELOPER users, checks for a dev-org-override cookie first.
 * This allows developers to switch between orgs without changing subdomains.
 */
export async function getCurrentOrgId(): Promise<string | undefined> {
  // Check for developer org override cookie
  // Security: Only developers can set this cookie via /api/developer/set-org
  try {
    const cookieStore = await cookies();
    const devOverride = cookieStore.get('dev-org-override')?.value;

    if (devOverride) {
      // Special value for "no org" (viewing orphaned records)
      // Return the special value so orgScope() can handle it
      if (devOverride === ORPHANED_RECORDS) {
        return ORPHANED_RECORDS;
      }
      // Return the override org ID directly
      return devOverride;
    }
  } catch {
    // cookies() may throw in some contexts (like during build)
    // Fall through to normal org detection
  }

  // Fall back to subdomain-based detection
  const org = await getCurrentOrganization();
  return org?.id;
}

/**
 * Create a Prisma where clause that scopes to the current organization
 * Uses strict scoping - only returns records belonging to the current org
 *
 * Special cases:
 * - If developer selected "__none__", returns { organizationId: null } to show only orphaned records
 * - If no org context (localhost dev), returns {} to match all records
 *
 * @example
 * const users = await prisma.user.findMany({
 *   where: {
 *     ...await orgScope(),
 *     isActive: true,
 *   }
 * });
 */
export async function orgScope(): Promise<{ organizationId: string | null } | Record<string, never>> {
  const orgId = await getCurrentOrgId();

  // Developer explicitly wants to view orphaned records
  if (orgId === ORPHANED_RECORDS) {
    return { organizationId: null };
  }

  if (orgId) {
    return { organizationId: orgId };
  }

  // No org context: return empty (match all - for localhost dev)
  return {};
}

/**
 * Create a Prisma where clause that strictly scopes to the current organization
 * Does NOT include legacy null records - use for new queries after migration
 */
export async function strictOrgScope(): Promise<{ organizationId: string | null } | Record<string, never>> {
  const orgId = await getCurrentOrgId();

  // Developer explicitly wants to view orphaned records
  if (orgId === ORPHANED_RECORDS) {
    return { organizationId: null };
  }

  if (orgId) {
    return { organizationId: orgId };
  }

  // No org context: return empty (match all)
  return {};
}

/**
 * Get the organizationId to use when creating new records
 * Returns undefined during migration period (records will have null organizationId)
 * Note: Returns undefined (not null) for __none__ since we don't create records while viewing orphaned
 */
export async function getOrgIdForCreate(): Promise<string | undefined> {
  const orgId = await getCurrentOrgId();
  // Don't use __none__ for creating records
  if (orgId === ORPHANED_RECORDS) {
    return undefined;
  }
  return orgId;
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
