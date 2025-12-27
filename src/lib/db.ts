import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma/client';
import { neonConfig } from '@neondatabase/serverless';

// Prevent multiple instances in development due to hot reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Connection configuration
const CONNECTION_CONFIG = {
  maxRetries: 5,
  initialRetryDelayMs: 1000, // Start with 1 second
  maxRetryDelayMs: 30000, // Cap at 30 seconds
  connectionTimeoutMs: 10000, // 10 second connection timeout
  queryTimeoutMs: 30000, // 30 second query timeout
};

// Circuit breaker state
let circuitBreakerOpen = false;
let circuitBreakerOpenUntil = 0;
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay with jitter
 */
const getRetryDelay = (attemptNumber: number): number => {
  const exponentialDelay = CONNECTION_CONFIG.initialRetryDelayMs * Math.pow(2, attemptNumber);
  const jitter = Math.random() * 1000; // Add up to 1 second of jitter
  return Math.min(exponentialDelay + jitter, CONNECTION_CONFIG.maxRetryDelayMs);
};

/**
 * Check if circuit breaker is open
 */
const isCircuitBreakerOpen = (): boolean => {
  if (circuitBreakerOpen && Date.now() > circuitBreakerOpenUntil) {
    // Circuit breaker timeout expired, close it
    circuitBreakerOpen = false;
    console.log('[DB] Circuit breaker closed, retrying connections');
  }
  return circuitBreakerOpen;
};

/**
 * Open circuit breaker to prevent cascading failures
 */
const openCircuitBreaker = () => {
  circuitBreakerOpen = true;
  circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT_MS;
  console.error('[DB] Circuit breaker opened due to repeated connection failures');
};

/**
 * Create Prisma client with retry logic and connection pooling
 */
const createPrismaClient = async (): Promise<PrismaClient> => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Configure Neon connection settings
  neonConfig.fetchConnectionCache = true;

  let lastError: Error | null = null;

  // Retry connection with exponential backoff
  for (let attempt = 0; attempt < CONNECTION_CONFIG.maxRetries; attempt++) {
    try {
      // Check circuit breaker
      if (isCircuitBreakerOpen()) {
        throw new Error('Circuit breaker is open, refusing to attempt connection');
      }

      // Create Prisma adapter for Neon (passing connection string directly)
      const adapter = new PrismaNeon({ connectionString });

      // Create Prisma client with adapter
      const client = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });

      // Test connection with timeout
      const connectPromise = client.$connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Connection timeout')),
          CONNECTION_CONFIG.connectionTimeoutMs
        )
      );

      await Promise.race([connectPromise, timeoutPromise]);

      // Connection successful
      if (attempt > 0) {
        console.log(`[DB] Connection established after ${attempt + 1} attempts`);
      }

      return client;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === CONNECTION_CONFIG.maxRetries - 1;

      console.error(
        `[DB] Connection attempt ${attempt + 1}/${CONNECTION_CONFIG.maxRetries} failed:`,
        error instanceof Error ? error.message : String(error)
      );

      if (isLastAttempt) {
        // Open circuit breaker after all retries exhausted
        openCircuitBreaker();
        break;
      }

      // Wait before retrying with exponential backoff
      const delay = getRetryDelay(attempt);
      console.log(`[DB] Retrying in ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw new Error(
    `Failed to connect to database after ${CONNECTION_CONFIG.maxRetries} attempts. ` +
      `Last error: ${lastError?.message || 'Unknown error'}`
  );
};

/**
 * Initialize Prisma client with error handling
 */
const initPrismaClient = (): PrismaClient => {
  // For the initial synchronous export, we create a client without connection
  // The actual connection will be established lazily on first query
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create Prisma adapter for Neon (passing connection string directly)
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? initPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
