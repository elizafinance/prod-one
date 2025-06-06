import './env-loader.js';

export const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // You can add more Redis-specific configurations here if needed,
  // e.g., password, db number, key prefixes.
  defaultQuestProgressKeyPrefix: 'quest:progress:', // e.g., quest:progress:QUEST_ID
  defaultQuestLockKeyPrefix: 'quest:lock:', // for optimistic locking or distributed locks
}; 