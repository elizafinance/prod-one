import { jest } from '@jest/globals';

// Mock next-auth to always return an admin session
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(() => Promise.resolve({
    user: {
      role: 'admin',
      walletAddress: '0xADMIN',
      id: 'TEST_ADMIN'
    }
  }))
}));

import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { POST } from '@/app/api/admin/quests/route';

// Polyfill global Request/Response for Node < 18 if necessary
import 'cross-fetch/polyfill';

describe('API: POST /api/admin/quests', () => {
  beforeAll(async () => {
    await ensureMongooseConnected();
  });

  it('should create a new community quest successfully', async () => {
    const requestBody = {
      title: 'Test Quest',
      description_md: 'This is a **test** quest.',
      goal_type: 'total_referrals',
      goal_target: 100,
      reward_type: 'points',
      reward_points: 500,
      start_ts: new Date().toISOString(),
      end_ts: new Date(Date.now() + 86400000).toISOString(), // +1 day
      scope: 'community'
    };

    const req = new Request('http://localhost/api/admin/quests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const res = await POST(req as any);

    expect(res.status).toBe(201);

    const data = await res.json();

    expect(data.title).toBe(requestBody.title);
    expect(data.goal_type).toBe(requestBody.goal_type);
    expect(data.goal_target).toBe(requestBody.goal_target);
    expect(data.scope).toBe(requestBody.scope);
  });
}); 