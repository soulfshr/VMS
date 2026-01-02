/**
 * Role Utility Functions
 *
 * Pattern-based role detection utilities for multi-tenant organizations.
 * These functions use slug patterns rather than hardcoded arrays to support
 * orgs with different naming conventions for similar role types.
 *
 * Examples:
 * - isLeadRole('ZONE_LEAD') => true
 * - isLeadRole('SHIFT_LEAD') => true
 * - isLeadRole('TEAM_LEAD') => true
 * - isDispatcherRole('DISPATCHER') => true
 * - isDispatcherRole('DISPATCH_COORDINATOR') => true
 */

/**
 * Check if a role slug indicates a lead-type role.
 * Matches: ZONE_LEAD, SHIFT_LEAD, TEAM_LEAD, LEAD, etc.
 * Excludes: REGIONAL_LEAD (which is a higher-level admin role)
 */
export function isLeadRole(slug: string): boolean {
  const upperSlug = slug.toUpperCase();
  // Exclude regional leads as they're admin-level, not shift-level
  if (upperSlug.includes('REGIONAL')) return false;
  return upperSlug.includes('LEAD');
}

/**
 * Check if a role slug indicates a dispatcher-type role.
 * Matches: DISPATCHER, DISPATCH_COORDINATOR, DISPATCH, etc.
 */
export function isDispatcherRole(slug: string): boolean {
  const upperSlug = slug.toUpperCase();
  return upperSlug.includes('DISPATCH');
}

/**
 * Check if a role slug indicates a verifier/escort-type role.
 * Matches: VERIFIER, ESCORT, VERIFY, etc.
 */
export function isVerifierRole(slug: string): boolean {
  const upperSlug = slug.toUpperCase();
  return (
    upperSlug === 'VERIFIER' ||
    upperSlug.includes('VERIFY') ||
    upperSlug.includes('ESCORT')
  );
}

/**
 * Check if a role slug indicates a shadow/observer-type role.
 * These roles typically don't count toward shift minimums.
 * Matches: SHADOW, SHADOWER, OBSERVER, TRAINEE, etc.
 */
export function isShadowRole(slug: string): boolean {
  const upperSlug = slug.toUpperCase();
  return (
    upperSlug.includes('SHADOW') ||
    upperSlug.includes('OBSERVER') ||
    upperSlug.includes('TRAINEE')
  );
}

/**
 * Check if a user role is a coordinator-level or higher.
 * This is for system roles (User.role), not qualified roles.
 */
export function isCoordinatorOrAbove(role: string): boolean {
  return ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(role);
}

/**
 * Check if a user role is an admin-level role.
 * This is for system roles (User.role), not qualified roles.
 */
export function isAdminRole(role: string): boolean {
  return ['ADMINISTRATOR', 'DEVELOPER'].includes(role);
}

/**
 * Check if a user role can create/edit shifts.
 * This is for system roles (User.role), not qualified roles.
 */
export function canManageShifts(role: string): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(role);
}

/**
 * Check if a user role can view all volunteers.
 * This is for system roles (User.role), not qualified roles.
 */
export function canViewAllVolunteers(role: string): boolean {
  return ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(role);
}

/**
 * Check if a user role can manage volunteer qualifications.
 * This is for system roles (User.role), not qualified roles.
 */
export function canManageQualifications(role: string): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(role);
}

/**
 * Check if a user has any lead-type qualification from their qualifications list.
 * @param qualificationSlugs Array of qualification slugs the user has
 */
export function hasLeadQualification(qualificationSlugs: string[]): boolean {
  return qualificationSlugs.some(slug => isLeadRole(slug));
}

/**
 * Check if a user has any dispatcher-type qualification from their qualifications list.
 * @param qualificationSlugs Array of qualification slugs the user has
 */
export function hasDispatcherQualification(qualificationSlugs: string[]): boolean {
  return qualificationSlugs.some(slug => isDispatcherRole(slug));
}

/**
 * Check if a user has any verifier-type qualification from their qualifications list.
 * @param qualificationSlugs Array of qualification slugs the user has
 */
export function hasVerifierQualification(qualificationSlugs: string[]): boolean {
  return qualificationSlugs.some(slug => isVerifierRole(slug));
}

/**
 * Get a display-friendly label for a role type based on its slug pattern.
 * Falls back to the slug itself if no pattern matches.
 * @param slug The role slug
 * @param customLabel Optional custom label to use instead of pattern matching
 */
export function getRoleTypeLabel(slug: string, customLabel?: string): string {
  if (customLabel) return customLabel;

  if (isLeadRole(slug)) return 'Lead';
  if (isDispatcherRole(slug)) return 'Dispatcher';
  if (isVerifierRole(slug)) return 'Verifier';
  if (isShadowRole(slug)) return 'Shadow';

  // Fallback: convert slug to title case
  return slug
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
