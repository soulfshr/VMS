/**
 * Audit Logging Service for RippleVMS
 *
 * Tracks all data changes for accountability and debugging:
 * - Full before/after diffs for updates
 * - Entity type and ID for traceability
 * - User info denormalized for display
 * - Fire-and-forget database writes (doesn't block requests)
 */

import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

// Entity types that can be audited
export type AuditEntityType =
  | 'User'
  | 'Shift'
  | 'ShiftVolunteer'
  | 'Zone'
  | 'OrganizationSettings'
  | 'QualifiedRole'
  | 'ShiftTypeConfig'
  | 'TrainingModule'
  | 'TrainingEnrollment'
  | 'IceSighting'
  | 'POI'
  | 'POICategory'
  | 'EmailBlast'
  | 'Auth';

// Action types
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';

// User context for audit logs
export interface AuditUser {
  id: string;
  email: string;
  name?: string | null;
}

interface AuditLogOptions {
  user: AuditUser;
  entityType: AuditEntityType;
  entityId?: string | null;
  action: AuditAction;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/**
 * Core audit logging function
 * Fire-and-forget - doesn't block the caller
 */
export async function auditLog(options: AuditLogOptions): Promise<void> {
  const { user, entityType, entityId, action, previousValue, newValue, metadata } = options;

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        entityType,
        entityId: entityId || null,
        action,
        previousValue: previousValue as Prisma.InputJsonValue | undefined,
        newValue: newValue as Prisma.InputJsonValue | undefined,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Don't let audit failures break the application
    console.error('[Audit] Failed to write audit log:', err);
  }
}

/**
 * Log a CREATE action
 */
export function auditCreate(
  user: AuditUser,
  entityType: AuditEntityType,
  entityId: string,
  newValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): void {
  // Fire and forget
  auditLog({
    user,
    entityType,
    entityId,
    action: 'CREATE',
    newValue: sanitizeForAudit(newValue),
    metadata,
  });
}

/**
 * Log an UPDATE action with before/after diff
 */
export function auditUpdate(
  user: AuditUser,
  entityType: AuditEntityType,
  entityId: string,
  previousValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): void {
  // Fire and forget
  auditLog({
    user,
    entityType,
    entityId,
    action: 'UPDATE',
    previousValue: sanitizeForAudit(previousValue),
    newValue: sanitizeForAudit(newValue),
    metadata,
  });
}

/**
 * Log a DELETE action
 */
export function auditDelete(
  user: AuditUser,
  entityType: AuditEntityType,
  entityId: string,
  previousValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): void {
  // Fire and forget
  auditLog({
    user,
    entityType,
    entityId,
    action: 'DELETE',
    previousValue: sanitizeForAudit(previousValue),
    metadata,
  });
}

/**
 * Log authentication events
 */
export function auditAuth(
  user: AuditUser,
  action: 'LOGIN' | 'LOGOUT',
  metadata?: Record<string, unknown>
): void {
  // Fire and forget
  auditLog({
    user,
    entityType: 'Auth',
    action,
    metadata,
  });
}

/**
 * Sanitize an object for audit logging
 * - Removes sensitive fields (passwords, tokens)
 * - Converts dates to ISO strings
 * - Handles nested objects
 */
function sanitizeForAudit(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'secret'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      result[key] = '[REDACTED]';
      continue;
    }

    // Handle different value types
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects, but only one level deep
      result[key] = sanitizeForAudit(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Extract only changed fields between two objects
 * Returns an object with only the fields that differ
 */
export function getChangedFields(
  previous: Record<string, unknown>,
  current: Record<string, unknown>
): { previous: Record<string, unknown>; current: Record<string, unknown> } {
  const changedPrev: Record<string, unknown> = {};
  const changedCurr: Record<string, unknown> = {};

  // Get all unique keys
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const key of allKeys) {
    const prevValue = previous[key];
    const currValue = current[key];

    // Compare values (handle dates specially)
    const prevStr = prevValue instanceof Date ? prevValue.toISOString() : JSON.stringify(prevValue);
    const currStr = currValue instanceof Date ? currValue.toISOString() : JSON.stringify(currValue);

    if (prevStr !== currStr) {
      changedPrev[key] = prevValue instanceof Date ? prevValue.toISOString() : prevValue;
      changedCurr[key] = currValue instanceof Date ? currValue.toISOString() : currValue;
    }
  }

  return { previous: changedPrev, current: changedCurr };
}

/**
 * Helper to create audit user from a database user object
 */
export function toAuditUser(user: { id: string; email: string; name?: string | null }): AuditUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
