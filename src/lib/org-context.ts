/**
 * Organization Context Helper
 *
 * This module provides utilities for multi-tenant organization context:
 * - Reading organization from middleware-injected headers
 * - Scoping database queries to current organization
 * - Fallback to default org during migration period
 */

import { headers } from 'next/headers';
import { prisma } from './db';

// Cache for organization lookups (simple in-memory cache)
const orgCache = new Map<string, { org: Awaited<ReturnType<typeof prisma.organization.findFirst>> | null; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Reserved slugs that cannot be used as organization subdomains
 */
export const RESERVED_SLUGS = [
  'app', 'www', 'api', 'admin', 'support', 'help',
  'mail', 'email', 'dev', 'dev-nc', 'staging', 'test',
  'localhost', 'static', 'assets', 'cdn'
];

/**
 * Extract organization slug from the request hostname
 * Used as fallback when middleware header is not available
 *
 * Examples:
 * - nc.ripple-vms.com -> 'nc'
 * - siembra.ripple-vms.com -> 'siembra'
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

  // Check for subdomain pattern: [slug].ripple-vms.com
  const parts = hostname.split('.');

  // Need at least 3 parts for a subdomain (e.g., nc.ripple-vms.com)
  if (parts.length < 3) {
    return null;
  }

  const slug = parts[0];

  // Check if it's a reserved slug
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return null;
  }

  return slug.toLowerCase();
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
 * Falls back to default organization during migration period
 *
 * @returns Organization with settings, or null if not found
 */
export async function getCurrentOrganization() {
  const slug = await getOrgSlugFromRequest();

  if (slug) {
    const org = await getOrganizationBySlug(slug);
    if (org) return org;
  }

  // Fallback to default org (migration compatibility)
  return getDefaultOrganization();
}

/**
 * Get the current organization ID for query scoping
 * Returns undefined for backward compatibility when no org context exists
 */
export async function getCurrentOrgId(): Promise<string | undefined> {
  const org = await getCurrentOrganization();
  return org?.id;
}

/**
 * Create a Prisma where clause that scopes to the current organization
 * Handles null organizationId for backward compatibility during migration
 *
 * @example
 * const users = await prisma.user.findMany({
 *   where: {
 *     ...await orgScope(),
 *     isActive: true,
 *   }
 * });
 */
export async function orgScope(): Promise<{ organizationId: string } | { OR: Array<{ organizationId: string | null }> }> {
  const orgId = await getCurrentOrgId();

  if (orgId) {
    // In multi-tenant mode: scope to current org OR legacy null org
    return {
      OR: [
        { organizationId: orgId },
        { organizationId: null }, // Include legacy records during migration
      ],
    };
  }

  // No org context: allow all (single-tenant mode / migration period)
  return {
    OR: [
      { organizationId: null },
    ],
  };
}

/**
 * Create a Prisma where clause that strictly scopes to the current organization
 * Does NOT include legacy null records - use for new queries after migration
 */
export async function strictOrgScope(): Promise<{ organizationId: string } | Record<string, never>> {
  const orgId = await getCurrentOrgId();

  if (orgId) {
    return { organizationId: orgId };
  }

  // No org context: return empty (match all)
  return {};
}

/**
 * Get the organizationId to use when creating new records
 * Returns undefined during migration period (records will have null organizationId)
 */
export async function getOrgIdForCreate(): Promise<string | undefined> {
  return getCurrentOrgId();
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
