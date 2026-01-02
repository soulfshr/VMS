/**
 * Centralized Permission Checks
 *
 * This module provides consistent permission checking across the application.
 * It centralizes the logic for determining what actions a user can perform
 * based on their system role and qualified roles.
 *
 * System Roles (User.role):
 * - VOLUNTEER: Basic volunteer access
 * - COORDINATOR: Can manage shifts, volunteers, and org settings
 * - DISPATCHER: Can view volunteers and manage dispatch assignments
 * - ADMINISTRATOR: Full access to all features
 * - DEVELOPER: Full access (for development/testing)
 *
 * Qualified Roles (UserQualification):
 * - Dynamic per-org roles like ZONE_LEAD, VERIFIER, DISPATCHER, etc.
 */

import {
  isLeadRole,
  isDispatcherRole,
  hasLeadQualification,
  hasDispatcherQualification,
} from './role-utils';

// System role types
export type SystemRole = 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';

// Permission context for checking permissions
export interface PermissionContext {
  systemRole: SystemRole;
  qualificationSlugs?: string[];
}

// ============================================================================
// SHIFT PERMISSIONS
// ============================================================================

/**
 * Check if user can create new shifts
 */
export function canCreateShift(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can edit shifts
 */
export function canEditShift(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can delete/cancel shifts
 */
export function canCancelShift(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can view draft shifts
 */
export function canViewDraftShifts(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can sign up for lead role on a shift
 */
export function canSignUpAsLead(ctx: PermissionContext): boolean {
  if (!ctx.qualificationSlugs) return false;
  return hasLeadQualification(ctx.qualificationSlugs);
}

// ============================================================================
// VOLUNTEER MANAGEMENT PERMISSIONS
// ============================================================================

/**
 * Check if user can view the full volunteer list
 */
export function canViewVolunteerList(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can edit volunteer profiles
 */
export function canEditVolunteers(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can manage volunteer qualifications
 */
export function canManageVolunteerQualifications(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can add volunteers to shifts
 */
export function canAddVolunteersToShift(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can remove volunteers from shifts
 */
export function canRemoveVolunteersFromShift(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can confirm/reject volunteer RSVPs
 */
export function canManageRsvps(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

// ============================================================================
// DISPATCH PERMISSIONS
// ============================================================================

/**
 * Check if user can access the dispatch feature
 */
export function canAccessDispatch(ctx: PermissionContext): boolean {
  // System role based
  if (['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole)) {
    return true;
  }
  // Qualification based
  if (ctx.qualificationSlugs && hasDispatcherQualification(ctx.qualificationSlugs)) {
    return true;
  }
  return false;
}

/**
 * Check if user can create/edit dispatcher assignments
 */
export function canManageDispatcherAssignments(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

// ============================================================================
// COVERAGE GRID PERMISSIONS
// ============================================================================

/**
 * Check if user can view the coverage grid
 */
export function canViewCoverageGrid(ctx: PermissionContext): boolean {
  // Lead-qualified users and coordinators+ can view coverage
  if (['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole)) {
    return true;
  }
  if (ctx.qualificationSlugs && hasLeadQualification(ctx.qualificationSlugs)) {
    return true;
  }
  return false;
}

/**
 * Check if user can sign up for slots in the coverage grid
 */
export function canSignUpForCoverage(ctx: PermissionContext): boolean {
  // Any logged-in user with appropriate qualifications can sign up
  return true;
}

// ============================================================================
// ADMIN PERMISSIONS
// ============================================================================

/**
 * Check if user can access admin settings
 */
export function canAccessAdminSettings(ctx: PermissionContext): boolean {
  return ['ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can manage organization settings
 */
export function canManageOrgSettings(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can manage qualified roles configuration
 */
export function canManageQualifiedRoles(ctx: PermissionContext): boolean {
  return ['ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can send email blasts
 */
export function canSendEmailBlast(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(ctx: PermissionContext): boolean {
  return ['ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

// ============================================================================
// DATA ACCESS PERMISSIONS
// ============================================================================

/**
 * Check if user can export data
 */
export function canExportData(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user can view analytics/reports
 */
export function canViewAnalytics(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a permission context from user data
 */
export function createPermissionContext(
  systemRole: string,
  qualificationSlugs?: string[]
): PermissionContext {
  return {
    systemRole: systemRole as SystemRole,
    qualificationSlugs: qualificationSlugs || [],
  };
}

/**
 * Check if user has elevated privileges (coordinator or above)
 */
export function hasElevatedPrivileges(ctx: PermissionContext): boolean {
  return ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}

/**
 * Check if user is an administrator
 */
export function isAdmin(ctx: PermissionContext): boolean {
  return ['ADMINISTRATOR', 'DEVELOPER'].includes(ctx.systemRole);
}
