import { NextResponse } from 'next/server';

interface RateLimitOptions {
  windowMs: number; // timeframe in ms
  max: number; // max requests in window
}

const ipBuckets: Map<string, { count: number; firstRequestTs: number }> = new Map();

export function withRateLimit<T extends (request: Request) => Promise<Response> | Response>(
  handler: T,
  options: RateLimitOptions = { windowMs: 30_000, max: 20 }
) {
  return async function (request: Request): Promise<Response> {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    const now = Date.now();
    const bucket = ipBuckets.get(ip);
    if (!bucket) {
      ipBuckets.set(ip, { count: 1, firstRequestTs: now });
    } else {
      if (now - bucket.firstRequestTs > options.windowMs) {
        bucket.count = 1;
        bucket.firstRequestTs = now;
      } else {
        bucket.count += 1;
      }

      if (bucket.count > options.max) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }
    }

    return handler(request);
  };
} 