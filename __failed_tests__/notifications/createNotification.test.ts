import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { connectToDatabase } from '@/lib/mongodb';
import { createNotification } from '@/lib/notificationUtils';

const WALLET = 'TestWallet';

describe('notificationUtils.createNotification', () => {
  let closeFn: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    // Ensure DB ready and clean
    const { db, client } = await connectToDatabase();
    await db.collection('notifications').deleteMany({});
    // capture close to clean up at end
    closeFn = () => client.close();
  });

  afterAll(async () => {
    await closeFn?.();
  });

  it('inserts a new notification the first time', async () => {
    const { db } = await connectToDatabase();
    await createNotification(db, WALLET, 'generic', 'Hello', 'Message');
    const count = await db.collection('notifications').countDocuments();
    expect(count).toBe(1);
  });

  it('deduplicates identical unread notifications', async () => {
    const { db } = await connectToDatabase();
    const coll = db.collection('notifications');
    const first = await coll.findOne({});
    expect(first).toBeTruthy();
    const firstUpdatedAt = first!.updatedAt;

    // Call again with same parameters → should NOT increase count
    await createNotification(db, WALLET, 'generic', 'Hello', 'Message');

    const countAfter = await coll.countDocuments();
    expect(countAfter).toBe(1);

    const docAfter = await coll.findOne({});
    expect(docAfter!.updatedAt.getTime()).toBeGreaterThanOrEqual(firstUpdatedAt.getTime());
  });
}); 