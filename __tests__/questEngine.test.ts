import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import CommunityQuest from '../src/models/communityQuest.model';
import QuestContribution from '../src/models/questContribution.model';
import { jest } from '@jest/globals';

// Dynamically imported handlers - will be assigned in beforeAll
let handleSquadPointsEvent: any;
let handleUserReferredEvent: any;
let handleUserTierUpdateEvent: any; // Added for completeness if testing later
let handleUserSpendEvent: any;    // Added for completeness if testing later

// Mock rabbitmq and redis services
// Note: Explicitly type the mockResolvedValue if needed, or ensure it matches expected Channel type
// For simplicity, if Channel is complex, jest.Mocked<Channel> or Partial<Channel> might be used.
// Here, an empty object should suffice if no channel methods are called in the tested handlers directly.
jest.mock('../src/services/rabbitmq.service', () => ({
  rabbitmqService: {
    publishToExchange: jest.fn(),
    getChannel: jest.fn().mockResolvedValue({} as any), // Typed as any to satisfy, or use actual Channel type if simple
  },
}));

jest.mock('../src/services/redis.service', () => ({
  redisService: {
    set: jest.fn(),
  },
  redisConfig: {
    defaultQuestProgressKeyPrefix: 'quest_progress:'
  }
}));

describe('QuestEngine Handlers', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Dynamically import the service and assign handlers
    const questEngineServiceModule = await import('../src/modules/quest-engine/questEngine.service.js');
    // Access handlers from the specifically named export for tests
    const testExports = questEngineServiceModule._testExports;
    if (testExports) {
        handleSquadPointsEvent = testExports.handleSquadPointsEvent;
        handleUserReferredEvent = testExports.handleUserReferredEvent;
        handleUserTierUpdateEvent = testExports.handleUserTierUpdateEvent;
        handleUserSpendEvent = testExports.handleUserSpendEvent;
    } else {
        throw new Error('_testExports not found on questEngineService. Ensure NODE_ENV=test and exports are correct.');
    }

    // Ensure handlers are loaded, otherwise tests will fail
    if (!handleSquadPointsEvent || !handleUserReferredEvent) {
        throw new Error('Quest engine event handlers could not be loaded for tests.');
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await CommunityQuest.deleteMany({});
    await QuestContribution.deleteMany({});
    jest.clearAllMocks();
  });

  describe('handleSquadPointsEvent', () => {
    it('should increment progress and publish events for a new contribution', async () => {
      const quest = await CommunityQuest.create({
        title: 'Squad Point Quest', description: 'Earn squad points', scope: 'squad',
        goal_type: 'total_squad_points', goal_target: 100, status: 'active',
        start_ts: new Date(Date.now() - 1000), end_ts: new Date(Date.now() + 1000000), rewards: [],
      });
      const message = { squadId: 'squad123', pointsChange: 50, timestamp: new Date().toISOString(), reason: 'test_points' };
  
      const result = await handleSquadPointsEvent(message);
      expect(result.success).toBe(true);
  
      const contribution = await QuestContribution.findOne({ quest_id: quest._id, user_id: 'squad123', squad_id: 'squad123' });
      expect(contribution).not.toBeNull();
      expect(contribution!.metric_value).toBe(50);
  
      const { rabbitmqService: rabbitMock } = await import('../src/services/rabbitmq.service');
      expect(rabbitMock.publishToExchange).toHaveBeenCalledTimes(1);
      // Add more specific assertions for publishToExchange arguments if needed
    });

    it('should not update contribution if pointsChange is not positive', async () => {
        const quest = await CommunityQuest.create({
            title: 'Squad Point Quest Negative', description: 'Test negative points', scope: 'squad',
            goal_type: 'total_squad_points', goal_target: 100, status: 'active',
            start_ts: new Date(Date.now() - 1000), end_ts: new Date(Date.now() + 1000000), rewards: [],
          });
          const message = { squadId: 'squad456', pointsChange: -10, timestamp: new Date().toISOString(), reason: 'test_negative' };
      
          const result = await handleSquadPointsEvent(message);
          expect(result.success).toBe(true); // Handler considers this a success (valid message, no processing needed)
      
          const contribution = await QuestContribution.findOne({ quest_id: quest._id, user_id: 'squad456' });
          expect(contribution).toBeNull(); // No contribution should be created for negative points change
    });
  });

  describe('handleUserReferredEvent', () => {
    it('should update contributions and publish events for a new referral', async () => {
      const quest = await CommunityQuest.create({
        title: 'Referral Quest', description: 'Refer users', scope: 'community',
        goal_type: 'total_referrals', goal_target: 5, status: 'active',
        start_ts: new Date(Date.now() - 1000), end_ts: new Date(Date.now() + 1000000), rewards: [],
      });
      const message = { userId: 'userB', referredByUserId: 'userA', timestamp: new Date().toISOString() };
  
      const result = await handleUserReferredEvent(message);
      expect(result.success).toBe(true);
  
      const contribution = await QuestContribution.findOne({ quest_id: quest._id, user_id: 'userA', squad_id: null });
      expect(contribution).not.toBeNull();
      expect(contribution!.metric_value).toBe(1);

      const { rabbitmqService: rabbitMock } = await import('../src/services/rabbitmq.service');
      expect(rabbitMock.publishToExchange).toHaveBeenCalledTimes(1);
    });
  });
}); 