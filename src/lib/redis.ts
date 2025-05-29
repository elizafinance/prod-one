import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.warn('[Redis] REDIS_URL env var not set – Redis features disabled');
}

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!redisUrl) return null;
  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableAutoPipelining: true,
    });
  }
  return redis;
} 