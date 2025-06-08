// Simple in-memory rate limiter for development/demo
// For production, use Redis-based rate limiting like `@upstash/ratelimit`

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max unique tokens (IPs) per interval
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit(config: RateLimitConfig) {
  return {
    async check(limit: number, token: string): Promise<void> {
      const now = Date.now();
      const key = `${token}:${Math.floor(now / config.interval)}`;
      
      // Clean up old entries
      for (const [entryKey, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
          rateLimitStore.delete(entryKey);
        }
      }
      
      const entry = rateLimitStore.get(key);
      
      if (!entry) {
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + config.interval
        });
        return;
      }
      
      if (entry.count >= limit) {
        throw new Error('Rate limit exceeded');
      }
      
      entry.count++;
    }
  };
} 