import { main as agentSyncMain } from '@/workers/agentPolicySync';
import { getRedis } from '@/lib/redis';
import * as mongo from '@/lib/mongodb';

jest.mock('@/lib/redis');
jest.mock('@/lib/mongodb');

const mockHset = jest.fn();
(getRedis as jest.Mock).mockReturnValue({ hset: mockHset });

const sampleUsers = [
  { _id: { toString: () => 'u1' }, agentId: 'agent1', walletAddress: 'addr1', agentRiskTolerance: 4, agentStatus: 'RUNNING' },
];
(mongo.connectToDatabase as jest.Mock).mockResolvedValue({
  db: { collection: () => ({ find: () => ({ toArray: () => sampleUsers }) }) },
  client: { close: jest.fn() },
});

describe('agentPolicySync worker', () => {
  it('writes risk tolerance to redis', async () => {
    await agentSyncMain();
    expect(mockHset).toHaveBeenCalledWith('agent:agent1', expect.objectContaining({ riskTolerance: '4' }));
  });
}); 