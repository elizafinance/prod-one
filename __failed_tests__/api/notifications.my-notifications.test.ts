import { jest } from '@jest/globals';
import { connectToDatabase } from '@/lib/mongodb';
import { GET as myNotificationsHandler } from '@/app/api/notifications/my-notifications/route';
import { getServerSession } from 'next-auth/next';

jest.mock('next-auth/next');

const WALLET = 'TestWallet';

describe('API GET /api/notifications/my-notifications', () => {
  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getServerSession as any).mockResolvedValue(Promise.resolve({ user: { walletAddress: WALLET } }));
    const { db } = await connectToDatabase();
    await db.collection('notifications').deleteMany({});
    await db.collection('squadInvitations').deleteMany({});

    // insert generic notification
    await db.collection('notifications').insertOne({
      userId: WALLET,
      type: 'generic',
      title: 'Welcome',
      message: 'Hello',
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // insert squad invite
    await db.collection('squadInvitations').insertOne({
      invitationId: 'inv1',
      squadId: 'squad1',
      squadName: 'Alpha',
      invitedByUserWalletAddress: 'Leader',
      invitedUserWalletAddress: WALLET,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('returns merged notifications and unread count', async () => {
    const request = new Request('http://localhost/api/notifications/my-notifications');
    const res = await myNotificationsHandler(request);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(data.unreadCount).toBe(2);
    const types = data.notifications.map((n: any) => n.type);
    expect(types).toEqual(expect.arrayContaining(['generic', 'squad_invite_received']));
  });
}); 