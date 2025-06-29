# Vercel Function Duration Optimization Guide

## Changes Implemented to Reduce Function Duration Costs

### 1. **Global Function Timeout (vercel.json)**
- Set 10-second maximum duration for all API functions
- Changed quest lifecycle cron from every minute to every 5 minutes
- This prevents runaway functions from consuming excessive compute time

### 2. **MongoDB Connection Pooling**
- Added connection pooling with optimized settings:
  - Production: 50 max connections, 10 min connections
  - Development: 10 max connections, 2 min connections
  - 10-second idle timeout
  - 5-second server selection timeout

### 3. **Streaming Export for Heavy Operations**
- Created `/api/admin/airdrop-export-optimized` endpoint
- Streams CSV data instead of loading all records into memory
- Implements 8-second timeout protection
- Processes data in 1000-record batches

### 4. **Function Monitoring System**
- Created `functionMonitoring.ts` utility to track:
  - Function execution times
  - Error rates and timeouts
  - Estimated monthly costs per endpoint
- Access metrics at `/api/admin/function-metrics` (admin only)

### 5. **Cron Job Locking**
- Implemented distributed locking for cron jobs
- Prevents concurrent executions of the same job
- Automatically expires locks after timeout
- Added to quest lifecycle cron to prevent overlaps

### 6. **Timeout Middleware**
- Created `functionTimeout.ts` middleware
- 9-second timeout (1s buffer before Vercel's limit)
- Warns when functions exceed 5 seconds
- Adds duration headers to responses

## Next Steps to Further Reduce Costs

### 1. **Add Pagination to Heavy Endpoints**
```typescript
// Example: Update /api/users/leaderboard
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '100');
const skip = (page - 1) * limit;

const users = await usersCollection
  .find({ points: { $gt: 0 } })
  .sort({ points: -1 })
  .skip(skip)
  .limit(limit)
  .toArray();
```

### 2. **Implement Redis Caching**
```typescript
// Install: yarn add ioredis
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache frequently accessed data
const cacheKey = `leaderboard:${page}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Store with expiration
await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min cache
```

### 3. **Use Edge Functions for Simple Operations**
```typescript
// Add to appropriate routes
export const runtime = 'edge'; // Uses less resources
```

### 4. **Implement Request Coalescing**
```typescript
// For endpoints like token balance checks
const pendingRequests = new Map();

async function getBalanceWithCoalescing(address: string) {
  if (pendingRequests.has(address)) {
    return pendingRequests.get(address);
  }
  
  const promise = fetchBalance(address);
  pendingRequests.set(address, promise);
  
  try {
    return await promise;
  } finally {
    pendingRequests.delete(address);
  }
}
```

### 5. **Add Background Job Queue**
```typescript
// Use Vercel Queue or BullMQ for heavy operations
// Move these to background jobs:
// - Proposal processing
// - Mass notifications
// - Data exports
```

## Monitoring Your Improvements

1. **Check Vercel Dashboard**:
   - Functions tab → View duration metrics
   - Usage tab → Monitor GB-hours consumed

2. **Use Function Metrics Endpoint**:
   ```bash
   curl https://your-app.vercel.app/api/admin/function-metrics?minutes=1440
   ```

3. **Set Up Alerts**:
   - Configure Vercel notifications for high usage
   - Monitor functions exceeding 5-second average

## Cost Estimation

Based on the analysis, your highest-cost functions were likely:
- Quest lifecycle cron (ran every minute)
- Leaderboard endpoints (fetching all users)
- Airdrop export (loading entire collection)

With these optimizations, you should see:
- **50-70% reduction** in function duration
- **80% reduction** in cron job costs (5x less frequent)
- **Better performance** for end users

## Emergency Measures

If costs are still high:
1. Temporarily disable non-critical cron jobs
2. Add stricter rate limiting
3. Reduce function memory allocation in vercel.json
4. Enable Vercel's spending limits

Remember to deploy these changes and monitor the impact over the next 24-48 hours.