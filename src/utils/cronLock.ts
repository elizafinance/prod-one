import { connectToDatabase } from '@/lib/mongodb';

interface CronLock {
  _id: string;
  lockedAt: Date;
  lockedBy: string;
  expiresAt: Date;
}

export class CronJobLock {
  private static readonly LOCK_COLLECTION = 'cron_locks';
  private static readonly DEFAULT_LOCK_DURATION = 5 * 60 * 1000; // 5 minutes

  static async acquireLock(
    jobName: string,
    lockDurationMs: number = this.DEFAULT_LOCK_DURATION
  ): Promise<boolean> {
    try {
      const { db } = await connectToDatabase();
      const locks = db.collection<CronLock>(this.LOCK_COLLECTION);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + lockDurationMs);
      const instanceId = `${process.env.VERCEL_REGION || 'local'}-${process.pid}`;

      // Try to acquire lock atomically
      const result = await locks.findOneAndUpdate(
        {
          _id: jobName,
          $or: [
            { expiresAt: { $lt: now } }, // Lock expired
            { expiresAt: { $exists: false } } // No lock exists
          ]
        },
        {
          $set: {
            _id: jobName,
            lockedAt: now,
            lockedBy: instanceId,
            expiresAt: expiresAt
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );

      const acquired = result !== null && result.lockedBy === instanceId;
      
      if (acquired) {
        console.log(`[CronLock] Lock acquired for ${jobName} by ${instanceId}`);
      } else {
        console.log(`[CronLock] Failed to acquire lock for ${jobName} - already locked`);
      }

      return acquired;
    } catch (error) {
      console.error(`[CronLock] Error acquiring lock for ${jobName}:`, error);
      return false;
    }
  }

  static async releaseLock(jobName: string): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const locks = db.collection<CronLock>(this.LOCK_COLLECTION);

      await locks.deleteOne({ _id: jobName });
      console.log(`[CronLock] Lock released for ${jobName}`);
    } catch (error) {
      console.error(`[CronLock] Error releasing lock for ${jobName}:`, error);
    }
  }

  static async withLock<T>(
    jobName: string,
    fn: () => Promise<T>,
    lockDurationMs?: number
  ): Promise<T | null> {
    const lockAcquired = await this.acquireLock(jobName, lockDurationMs);
    
    if (!lockAcquired) {
      console.log(`[CronLock] Skipping ${jobName} - another instance is running`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(jobName);
    }
  }
}