import { getPointsService } from '@/services/points.service';
import * as mongo from '@/lib/mongodb';

jest.mock('@/services/rabbitmq.service', () => ({ rabbitmqService: { publishToExchange: jest.fn() } }));
jest.mock('@/config/rabbitmq.config', () => ({ rabbitmqConfig: { eventsExchange: 'events', routingKeys: {} } }));

// In-memory mock collections
function makeMockCollection(initialData: any[] = []) {
  return {
    data: initialData,
    findOne: jest.fn(async (query: any) => {
      const key = Object.keys(query)[0];
      const value = query[key];
      return initialData.find((d) => {
        if (key === '_id') return d._id?.toString() === value.toString();
        return d[key] === value;
      }) || null;
    }),
    updateOne: jest.fn(async (query: any, update: any) => {
      const user = initialData.find((d) => d._id?.toString() === (query._id?.toString?.() || query._id) || d.walletAddress === query.walletAddress);
      if (!user) return { matchedCount: 0, modifiedCount: 0 };
      if (update.$set) Object.assign(user, update.$set);
      if (update.$inc) {
        Object.entries(update.$inc).forEach(([k, v]: [string, any]) => {
          // @ts-ignore
          user[k] = (user[k] || 0) + v;
        });
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }),
    insertOne: jest.fn(async (doc: any) => {
      initialData.push(doc);
      return { insertedId: doc._id || 'newId' };
    }),
    aggregate: jest.fn(() => ({ toArray: async () => [] })),
  } as any;
}

const usersData: any[] = [
  { _id: { toString: () => 'id1' }, xUserId: 'x1', points: 0, referralsMadeCount: 0 },
];
const actionsData: any[] = [];
const squadsData: any[] = [];

(mongo.connectToDatabase as unknown as jest.Mock) = jest.fn().mockResolvedValue({
  db: {
    collection: (name: string) => {
      if (name === 'users') return makeMockCollection(usersData);
      if (name === 'actions') return makeMockCollection(actionsData);
      return makeMockCollection(squadsData);
    },
  },
});

describe('PointsService.addPointsByUserId', () => {
  it('adds points to user identified by _id when walletAddress missing', async () => {
    const service = await getPointsService();
    const result = await service.addPointsByUserId('id1', 20, { reason: 'unit_test', actionType: 'referral_bonus' });
    expect(result?.points).toBe(20);
    expect(actionsData.length).toBe(1);
    expect(actionsData[0]).toEqual(expect.objectContaining({ actionType: 'referral_bonus', pointsAwarded: 20 }));
  });
}); 