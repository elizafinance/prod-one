// Simple in-memory rate limiter for development/demo
// For production, use Redis-based rate limiting like `@upstash/ratelimit`
const rateLimitStore = new Map();
export function rateLimit(config) {
    return {
        async check(limit, token) {
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
