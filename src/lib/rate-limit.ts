/**
 * Distributed rate limiter using Upstash Redis
 * Falls back to in-memory rate limiting if Redis is not configured
 *
 * For production, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * in your environment variables. Get these from https://console.upstash.com
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// ============================================
// UPSTASH REDIS RATE LIMITER (DISTRIBUTED)
// ============================================

// Check if Upstash is configured
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Initialize Redis client if configured
const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Create rate limiters for different use cases
const rateLimiters = redis
  ? {
      login: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 attempts per minute
        analytics: true,
        prefix: 'ratelimit:login',
      }),
      forgotPassword: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '300 s'), // 3 per 5 minutes
        analytics: true,
        prefix: 'ratelimit:forgot-password',
      }),
      resetPassword: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '300 s'), // 5 per 5 minutes
        analytics: true,
        prefix: 'ratelimit:reset-password',
      }),
      upload: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 uploads per minute
        analytics: true,
        prefix: 'ratelimit:upload',
      }),
      sighting: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 sighting reports per minute
        analytics: true,
        prefix: 'ratelimit:sighting',
      }),
      feedback: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '60 s'), // 3 feedback submissions per minute
        analytics: true,
        prefix: 'ratelimit:feedback',
      }),
      api: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '60 s'), // 100 requests per minute
        analytics: true,
        prefix: 'ratelimit:api',
      }),
    }
  : null;

// ============================================
// IN-MEMORY FALLBACK RATE LIMITER
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (fallback)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// ============================================
// SHARED TYPES AND CONFIGURATION
// ============================================

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Pre-configured rate limit configs for common use cases
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits
  login: { limit: 5, windowSeconds: 60 }, // 5 attempts per minute
  forgotPassword: { limit: 3, windowSeconds: 300 }, // 3 per 5 minutes
  resetPassword: { limit: 5, windowSeconds: 300 }, // 5 per 5 minutes

  // Public submission endpoints
  upload: { limit: 10, windowSeconds: 60 }, // 10 uploads per minute
  sighting: { limit: 5, windowSeconds: 60 }, // 5 sighting reports per minute
  feedback: { limit: 3, windowSeconds: 60 }, // 3 feedback submissions per minute

  // General API calls
  api: { limit: 100, windowSeconds: 60 }, // 100 requests per minute
} as const;

// Map config keys to Upstash rate limiter keys
type RateLimitKey = keyof typeof RATE_LIMITS;

// ============================================
// MAIN RATE LIMIT FUNCTION
// ============================================

/**
 * Check if a request should be rate limited
 * Uses Upstash Redis if configured, otherwise falls back to in-memory
 * @param identifier - Unique identifier (e.g., "login:192.168.1.1")
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Extract the rate limit type from identifier (e.g., "login" from "login:192.168.1.1")
  const rateLimitType = identifier.split(':')[0] as RateLimitKey;

  // Try to use Upstash if configured
  if (rateLimiters && rateLimitType in rateLimiters) {
    try {
      const limiter = rateLimiters[rateLimitType];
      const result = await limiter.limit(identifier);

      // Log rate limit violations
      if (!result.success) {
        logger.rateLimit(rateLimitType, identifier.split(':')[1] || 'unknown', { remaining: result.remaining }).catch(() => {});
      }

      return {
        success: result.success,
        remaining: result.remaining,
        resetTime: result.reset,
        retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch (error) {
      logger.warn('RATE_LIMIT', 'Upstash error, falling back to in-memory', { error: error instanceof Error ? error.message : 'Unknown' }).catch(() => {});
      // Fall through to in-memory rate limiting
    }
  }

  // Fallback to in-memory rate limiting
  return checkRateLimitInMemory(identifier, config);
}

/**
 * Synchronous rate limit check (for backwards compatibility)
 * Uses in-memory rate limiting only
 * @deprecated Use checkRateLimitAsync for distributed rate limiting
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  // Log warning if Upstash is configured but sync function is used
  if (isUpstashConfigured) {
    console.warn('[RateLimit] Using sync checkRateLimit with Upstash configured. Consider using checkRateLimitAsync.');
  }
  return checkRateLimitInMemory(identifier, config);
}

/**
 * In-memory rate limit check
 */
function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // No existing entry or window expired - create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      success: true,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Window still active
  if (entry.count >= config.limit) {
    // Rate limit exceeded - log the violation
    const rateLimitType = identifier.split(':')[0] || 'unknown';
    const ipAddress = identifier.split(':')[1] || 'unknown';
    logger.rateLimit(rateLimitType, ipAddress, { remaining: 0 }).catch(() => {});

    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Increment count
  entry.count++;

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get client IP from request headers
 * Works with Vercel, Cloudflare, and standard proxies
 */
export function getClientIp(request: Request): string {
  // Vercel
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Real IP header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return 'unknown';
}

/**
 * Create rate limit response with appropriate headers
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Limit': String(result.remaining + 1),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
      },
    }
  );
}

/**
 * Check if Upstash Redis is configured
 * Useful for monitoring and debugging
 */
export function isDistributedRateLimitingEnabled(): boolean {
  return isUpstashConfigured;
}
