#!/usr/bin/env ts-node

import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { MongoClient } from 'mongodb';
import { getRedis } from '@/lib/redis';

/**
 * This worker runs periodically (cron, GitHub action, or serverless timer)
 * It looks for users with RUNNING agents and pushes their latest
 * riskTolerance + wallet info to an agent-runner key-value store (e.g. Redis).
 * For now we just log – integrate with real queue later.
 */
async function main() {
  const { db, client } = await connectToDatabase();
  const users = db.collection<UserDocument>('users');

  const cursor = users.find({ agentStatus: 'RUNNING' });
  const all = await cursor.toArray();
  console.log(`[AgentPolicySync] Found ${all.length} active agents to sync.`);

  for (const u of all) {
    const risk = (u as any).agentRiskTolerance ?? 3;

    const redis = getRedis();
    if (!redis) {
      console.warn('[AgentPolicySync] Redis disabled – skipping HSET');
      continue;
    }

    const key = `agent:${u.agentId}`;
    const data = {
      userId: u._id?.toString() || '',
      wallet: u.walletAddress || '',
      riskTolerance: risk.toString(),
      updatedAt: Date.now().toString(),
    };
    try {
      await redis.hset(key, data);
      console.log(`[AgentPolicySync] Updated ${key} in Redis.`);
    } catch (err:any) {
      console.error('[AgentPolicySync] Redis HSET failed', err);
    }
  }

  // Close connection when script ends
  await client.close();
}

export { main };

// Only execute if run directly (node script) not when imported
if (require.main === module) {
  main().catch((err) => {
    console.error('[AgentPolicySync] fatal error', err);
    process.exit(1);
  });
} 