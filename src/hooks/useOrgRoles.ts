'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getRoleTypeLabel, isLeadRole, isDispatcherRole, isVerifierRole, isShadowRole } from '@/lib/role-utils';

/**
 * Qualified role data from the API
 */
export interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  countsTowardMinimum: boolean;
}

/**
 * Role category for grouping/filtering
 */
export type RoleCategory = 'lead' | 'dispatcher' | 'verifier' | 'shadow' | 'other';

/**
 * Hook for accessing organization-specific qualified roles
 *
 * Provides:
 * - Dynamic role names from org configuration
 * - Role lookup utilities
 * - Role categorization helpers
 *
 * Usage:
 * ```tsx
 * const { roles, getRoleName, getRoleColor, isLoading } = useOrgRoles();
 *
 * // Get display name for a role slug
 * const displayName = getRoleName('ZONE_LEAD'); // "Zone Lead" or org-specific name
 *
 * // Get role color
 * const color = getRoleColor('VERIFIER'); // "#6366f1" or org-specific color
 * ```
 */
export function useOrgRoles() {
  const [roles, setRoles] = useState<QualifiedRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch roles on mount
  useEffect(() => {
    let mounted = true;

    async function fetchRoles() {
      try {
        const response = await fetch('/api/roles');
        if (!response.ok) {
          throw new Error('Failed to fetch roles');
        }
        const data = await response.json();
        if (mounted) {
          setRoles(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchRoles();

    return () => {
      mounted = false;
    };
  }, []);

  // Create a lookup map for O(1) access
  const rolesBySlug = useMemo(() => {
    const map = new Map<string, QualifiedRole>();
    for (const role of roles) {
      map.set(role.slug.toUpperCase(), role);
    }
    return map;
  }, [roles]);

  const rolesById = useMemo(() => {
    const map = new Map<string, QualifiedRole>();
    for (const role of roles) {
      map.set(role.id, role);
    }
    return map;
  }, [roles]);

  /**
   * Get the display name for a role by slug
   * Falls back to pattern-based label if role not found
   */
  const getRoleName = useCallback(
    (slug: string): string => {
      if (!slug) return '';
      const role = rolesBySlug.get(slug.toUpperCase());
      if (role) return role.name;
      // Fallback to pattern-based label
      return getRoleTypeLabel(slug);
    },
    [rolesBySlug]
  );

  /**
   * Get the display name for a role by ID
   */
  const getRoleNameById = useCallback(
    (id: string): string => {
      if (!id) return '';
      const role = rolesById.get(id);
      return role?.name || '';
    },
    [rolesById]
  );

  /**
   * Get the color for a role by slug
   */
  const getRoleColor = useCallback(
    (slug: string): string => {
      if (!slug) return '#6366f1'; // Default indigo
      const role = rolesBySlug.get(slug.toUpperCase());
      return role?.color || '#6366f1';
    },
    [rolesBySlug]
  );

  /**
   * Get the color for a role by ID
   */
  const getRoleColorById = useCallback(
    (id: string): string => {
      if (!id) return '#6366f1';
      const role = rolesById.get(id);
      return role?.color || '#6366f1';
    },
    [rolesById]
  );

  /**
   * Get a role by slug
   */
  const getRoleBySlug = useCallback(
    (slug: string): QualifiedRole | undefined => {
      return rolesBySlug.get(slug.toUpperCase());
    },
    [rolesBySlug]
  );

  /**
   * Get a role by ID
   */
  const getRoleById = useCallback(
    (id: string): QualifiedRole | undefined => {
      return rolesById.get(id);
    },
    [rolesById]
  );

  /**
   * Get the category of a role (lead, dispatcher, verifier, shadow, other)
   */
  const getRoleCategory = useCallback((slug: string): RoleCategory => {
    if (isLeadRole(slug)) return 'lead';
    if (isDispatcherRole(slug)) return 'dispatcher';
    if (isVerifierRole(slug)) return 'verifier';
    if (isShadowRole(slug)) return 'shadow';
    return 'other';
  }, []);

  /**
   * Filter roles by category
   */
  const getRolesByCategory = useCallback(
    (category: RoleCategory): QualifiedRole[] => {
      return roles.filter((role) => getRoleCategory(role.slug) === category);
    },
    [roles, getRoleCategory]
  );

  /**
   * Get roles that count toward shift minimums
   */
  const countingRoles = useMemo(() => {
    return roles.filter((role) => role.countsTowardMinimum);
  }, [roles]);

  /**
   * Get roles that don't count toward shift minimums (e.g., shadows)
   */
  const nonCountingRoles = useMemo(() => {
    return roles.filter((role) => !role.countsTowardMinimum);
  }, [roles]);

  /**
   * Check if a role slug represents a lead-type role
   */
  const isLead = useCallback((slug: string): boolean => {
    return isLeadRole(slug);
  }, []);

  /**
   * Check if a role slug represents a dispatcher-type role
   */
  const isDispatcher = useCallback((slug: string): boolean => {
    return isDispatcherRole(slug);
  }, []);

  return {
    // State
    roles,
    isLoading,
    error,

    // Lookup utilities
    getRoleName,
    getRoleNameById,
    getRoleColor,
    getRoleColorById,
    getRoleBySlug,
    getRoleById,

    // Categorization
    getRoleCategory,
    getRolesByCategory,
    countingRoles,
    nonCountingRoles,

    // Pattern checks
    isLead,
    isDispatcher,
  };
}

/**
 * Type for role select options
 */
export interface RoleSelectOption {
  value: string;
  label: string;
  color?: string;
}

/**
 * Convert roles to select options
 */
export function rolesToSelectOptions(roles: QualifiedRole[]): RoleSelectOption[] {
  return roles.map((role) => ({
    value: role.id,
    label: role.name,
    color: role.color,
  }));
}
