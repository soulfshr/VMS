/**
 * Centralized Logging Service for RippleVMS
 *
 * Replaces ad-hoc console.log with structured logging that:
 * - Logs to console for Vercel log aggregation
 * - Stores important events (INFO+) to database for dashboard
 * - Supports categories and severity levels
 * - Fire-and-forget database writes (doesn't block requests)
 */

import { prisma } from '@/lib/db';
import { LogSeverity, LogCategory } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';

interface LogOptions {
  severity: LogSeverity;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  endpoint?: string;
  ipAddress?: string;
  durationMs?: number;
}

// Log levels that should be stored in database (INFO and above)
const DB_SEVERITY_THRESHOLD: LogSeverity[] = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];

// Console prefixes for each category (matching existing patterns)
const CATEGORY_PREFIXES: Record<LogCategory, string> = {
  AUTH: '[Auth]',
  EMAIL: '[Email]',
  RSVP: '[RSVP]',
  SIGHTING: '[Sightings]',
  ADMIN: '[Admin]',
  SYSTEM: '[System]',
  RATE_LIMIT: '[RateLimit]',
  API: '[API]',
};

/**
 * Log an event to console and optionally to database
 * Database writes are fire-and-forget to avoid blocking API requests
 */
export async function log(options: LogOptions): Promise<void> {
  const { severity, category, message, metadata, ...context } = options;

  // Build console message with prefix
  const prefix = CATEGORY_PREFIXES[category] || `[${category}]`;
  const logMessage = `${prefix} [${severity}] ${message}`;

  // Choose console method based on severity
  const consoleMethod =
    severity === 'ERROR' || severity === 'CRITICAL'
      ? console.error
      : severity === 'WARN'
        ? console.warn
        : console.log;

  // Log to console with metadata if present
  if (metadata && Object.keys(metadata).length > 0) {
    consoleMethod(logMessage, metadata);
  } else {
    consoleMethod(logMessage);
  }

  // Store important events in database (fire and forget - don't await in caller)
  if (DB_SEVERITY_THRESHOLD.includes(severity)) {
    try {
      await prisma.systemLog.create({
        data: {
          severity,
          category,
          message,
          metadata: (metadata || undefined) as Prisma.InputJsonValue | undefined,
          ...context,
        },
      });
    } catch (err) {
      // Don't let logging failures break the application
      console.error('[Logger] Failed to write to database:', err);
    }
  }
}

/**
 * Convenience methods matching existing logging patterns
 */
export const logger = {
  /**
   * Debug level - console only, not stored in database
   */
  debug: (category: LogCategory, message: string, metadata?: Record<string, unknown>) =>
    log({ severity: 'DEBUG', category, message, metadata }),

  /**
   * Info level - stored in database
   */
  info: (category: LogCategory, message: string, metadata?: Record<string, unknown>) =>
    log({ severity: 'INFO', category, message, metadata }),

  /**
   * Warning level - stored in database
   */
  warn: (category: LogCategory, message: string, metadata?: Record<string, unknown>) =>
    log({ severity: 'WARN', category, message, metadata }),

  /**
   * Error level - stored in database
   */
  error: (category: LogCategory, message: string, metadata?: Record<string, unknown>) =>
    log({ severity: 'ERROR', category, message, metadata }),

  /**
   * Critical level - stored in database, may trigger alerts
   */
  critical: (category: LogCategory, message: string, metadata?: Record<string, unknown>) =>
    log({ severity: 'CRITICAL', category, message, metadata }),

  /**
   * API-specific logging with timing information
   * Automatically determines severity based on HTTP status
   */
  api: (
    endpoint: string,
    durationMs: number,
    status: number,
    metadata?: Record<string, unknown>
  ) => {
    const severity: LogSeverity =
      status >= 500 ? 'ERROR' :
      status >= 400 ? 'WARN' :
      durationMs > 3000 ? 'WARN' : // Slow requests
      'INFO';

    return log({
      severity,
      category: 'API',
      message: `${endpoint} responded ${status} in ${durationMs}ms`,
      endpoint,
      durationMs,
      metadata: { status, ...metadata },
    });
  },

  /**
   * Rate limit violation logging
   */
  rateLimit: (
    endpoint: string,
    ipAddress: string,
    metadata?: Record<string, unknown>
  ) => log({
    severity: 'WARN',
    category: 'RATE_LIMIT',
    message: `Rate limit hit on ${endpoint}`,
    endpoint,
    ipAddress,
    metadata,
  }),

  /**
   * Authentication event logging
   */
  auth: (
    event: 'login' | 'logout' | 'password_reset' | 'failed_login',
    userId: string | undefined,
    metadata?: Record<string, unknown>
  ) => {
    const severity: LogSeverity = event === 'failed_login' ? 'WARN' : 'INFO';
    return log({
      severity,
      category: 'AUTH',
      message: `Auth event: ${event}`,
      userId,
      metadata,
    });
  },

  /**
   * Email event logging - accepts any descriptive message
   */
  email: (
    message: string,
    metadata?: Record<string, unknown>
  ) => {
    const severity: LogSeverity = message.toLowerCase().includes('failed') ? 'ERROR' : 'INFO';
    return log({
      severity,
      category: 'EMAIL',
      message,
      metadata,
    });
  },
};

export default logger;
