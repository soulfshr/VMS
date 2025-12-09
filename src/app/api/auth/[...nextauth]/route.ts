import { handlers } from '@/auth';
import { NextRequest } from 'next/server';
import { checkRateLimitAsync, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export const { GET } = handlers;

// Wrap POST handler with rate limiting for login attempts
export async function POST(request: NextRequest) {
  // Only rate limit signin requests (credentials login)
  const url = new URL(request.url);
  const isSignIn = url.pathname.includes('callback/credentials');

  if (isSignIn) {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimitAsync(`login:${clientIp}`, RATE_LIMITS.login);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }
  }

  return handlers.POST(request);
}
