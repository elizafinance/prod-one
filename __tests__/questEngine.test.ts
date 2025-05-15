import mongoose from 'mongoose';
// import { MongoMemoryServer } from 'mongodb-memory-server'; // No longer needed here
import CommunityQuest from '../src/models/communityQuest.model';
import QuestContribution from '../src/models/questContribution.model';
import { jest } from '@jest/globals';

// Dynamically imported handlers - will be assigned in beforeAll
let handleSquadPointsEvent: any;
let handleUserReferredEvent: any;
let handleUserTierUpdateEvent: any; // Added for completeness if testing later
let handleUserSpendEvent: any;    // Added for completeness if testing later

// Interface for the expected structure of _testExports if NODE_ENV is 'test'
interface QuestEngineTestExports {
  handleUserReferredEvent?: Function; // Using Function as a general type for now
  handleUserTierUpdateEvent?: Function;
  handleUserSpendEvent?: Function;
  handleSquadPointsEvent?: Function;
}

// Mock rabbitmq and redis services
// Note: Explicitly type the mockResolvedValue if needed, or ensure it matches expected Channel type
// For simplicity, if Channel is complex, jest.Mocked<Channel> or Partial<Channel> might be used.
// Here, an empty object should suffice if no channel methods are called in the tested handlers directly.
jest.mock('../src/services/rabbitmq.service', () => ({
  rabbitmqService: {
    publishToExchange: jest.fn(),
    getChannel: jest.fn(() => Promise.resolve({ // Return a Promise that resolves to the mock channel
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
    })),
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
  // let mongoServer: MongoMemoryServer; // Handled by globalSetup

  beforeAll(async () => {
    // mongoServer = await MongoMemoryServer.create(); // Handled by globalSetup
    // await mongoose.connect(mongoServer.getUri()); // Handled by globalSetup via process.env.MONGODB_URI
    // Ensure mongoose connects using the URI from globalSetup
    if (mongoose.connection.readyState === 0) { // 0 = disconnected
        await mongoose.connect(process.env.MONGODB_URI!);
    } else {
        // If already connected (e.g. by a previous test suite or persistent connection), ensure it's the test DB
        // This might not be strictly necessary if Jest isolates environments or if Mongoose uses the new URI correctly.
    }

    const questEngineServiceModule = await import('../src/modules/quest-engine/questEngine.service.js');
    // Cast _testExports to the defined interface to satisfy TypeScript
    const testExports = questEngineServiceModule._testExports as QuestEngineTestExports;
    
    if (testExports?.handleSquadPointsEvent) {
        handleSquadPointsEvent = testExports.handleSquadPointsEvent;
    } else {
        throw new Error('handleSquadPointsEvent not found in _testExports');
    }
    if (testExports?.handleUserReferredEvent) {
        handleUserReferredEvent = testExports.handleUserReferredEvent;
    } else {
        throw new Error('handleUserReferredEvent not found in _testExports');
    }
    // Optional: Assign other handlers if they will be tested
    handleUserTierUpdateEvent = testExports.handleUserTierUpdateEvent;
    handleUserSpendEvent = testExports.handleUserSpendEvent;

    // Initial check to ensure they are callable functions after assignment
    if (typeof handleSquadPointsEvent !== 'function' || typeof handleUserReferredEvent !== 'function') {
        throw new Error('Quest engine event handlers could not be loaded correctly for tests.');
    }
  });

  afterAll(async () => {
    // await mongoose.disconnect(); // Disconnection handled by globalTeardown or if mongoose manages its own pool
    // await mongoServer.stop(); // Handled by globalTeardown
    // It's generally safer to let the globalTeardown handle the main disconnect if Mongoose shares the connection.
    // If each test suite file makes its own mongoose.connect, then it should also disconnect.
    // Given globalSetup provides MONGODB_URI, Mongoose might connect once and reuse.
    // For safety, if this test file initiated a specific connection, it should close it.
    // However, the goal of globalSetup is often to avoid this per-suite setup/teardown.
    // Let's assume Mongoose will use the connection established via global MONGODB_URI
    // and globalTeardown will stop the server, implicitly closing connections.
    // If granular control is needed: mongoose.connection.close() here might be okay.
  });

  beforeEach(async () => { // Changed from afterEach to ensure clean state before each test
    // Clear data before each test for isolation
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