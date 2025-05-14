// __tests__/scripts/cron/processProposals.test.ts
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { processEndedProposals, archiveOldClosedProposals } from '@/scripts/cron/processProposals';
import { Proposal, IProposal } from '@/models/Proposal';
import { Vote, IVote } from '@/models/Vote';
import { Squad, ISquad } from '@/models/Squad';
import { Notification } from '@/models/Notification';

// Mock Mongoose models and connection
jest.mock('@/models/Proposal');
jest.mock('@/models/Vote');
jest.mock('@/models/Squad');
jest.mock('@/models/Notification');

// Mock mongoose.connect and mongoose.disconnect
const mockConnect = jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose); // Mock it to resolve with mongoose itself or a mock connection object
const mockDisconnect = jest.spyOn(mongoose, 'disconnect').mockResolvedValue(undefined);

const MockedProposal = Proposal as jest.Mocked<typeof Proposal>;
const MockedVote = Vote as jest.Mocked<typeof Vote>;
const MockedSquad = Squad as jest.Mocked<typeof Squad>;
const MockedNotification = Notification as jest.Mocked<typeof Notification>;

describe('processProposals Cron Job', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore: Setup mock implementation for model methods
    MockedProposal.find = jest.fn();
    MockedProposal.findById = jest.fn();
    // @ts-ignore
    MockedProposal.prototype.save = jest.fn().mockResolvedValue(this);
    MockedProposal.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0, matchedCount: 0 });
    
    // @ts-ignore
    MockedVote.find = jest.fn();
    
    MockedSquad.findById = jest.fn();
    
    MockedNotification.insertMany = jest.fn().mockResolvedValue([]);
    
    // Mock process.env variables used in the script if necessary
    process.env.CRON_PROPOSAL_PASS_THRESHOLD = '0';
    process.env.CRON_PROPOSAL_ARCHIVE_DELAY_DAYS = '7';
    process.env.NEXT_PUBLIC_PROPOSAL_BROADCAST_THRESHOLD = '1000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db'; // Dummy URI for tests

    // Mock Mongoose connection state if your script checks it
    Object.defineProperty(mongoose, 'connection', {
        value: { readyState: 1 }, // 1 for connected
        writable: true,
        configurable: true,
    });
  });

  afterEach(async () => {
    // Restore original env variables if they were modified
    // delete process.env.CRON_PROPOSAL_PASS_THRESHOLD; // etc.
  });

  describe('processEndedProposals', () => {
    it('should correctly identify, process, and set status for a proposal that passes and gets executed', async () => {
      const mockProposalId = new mongoose.Types.ObjectId();
      const mockSquadId = new mongoose.Types.ObjectId();
      const mockActiveProposal: Partial<IProposal> = {
        _id: mockProposalId,
        squadId: mockSquadId,
        tokenName: 'Test Token Pass',
        squadName: 'Test Squad',
        status: 'active',
        epochEnd: new Date(Date.now() - 100000), // Past date
        broadcasted: false,
        save: jest.fn().mockResolvedValue(this), // Mock save on the instance
      };
      MockedProposal.find.mockResolvedValue([mockActiveProposal as IProposal]);

      const mockVotes: Partial<IVote>[] = [
        { choice: 'up', voterPointsAtCast: 600 },
        { choice: 'down', voterPointsAtCast: 100 },
      ];
      MockedVote.find.mockResolvedValue(mockVotes as IVote[]);

      MockedSquad.findById.mockResolvedValue({
        _id: mockSquadId,
        squadId: 'squad-pass-123',
        name: 'Test Squad',
        memberWalletAddresses: ['wallet1', 'wallet2'],
      } as ISquad);

      await processEndedProposals();

      expect(MockedProposal.find).toHaveBeenCalledWith({ status: 'active', epochEnd: { $lt: expect.any(Date) } });
      expect(mockActiveProposal.save).toHaveBeenCalledTimes(2); // Once for status, once for broadcast (if threshold met and passed)
      expect(mockActiveProposal.status).toBe('closed_executed'); // distributeTokens mock sets this
      expect(mockActiveProposal.finalUpVotesWeight).toBe(600);
      expect(mockActiveProposal.finalDownVotesWeight).toBe(100);
      expect(mockActiveProposal.finalUpVotesCount).toBe(1);
      expect(mockActiveProposal.finalDownVotesCount).toBe(1);
      expect(MockedNotification.insertMany).toHaveBeenCalled();
      // Add more specific assertions for notification content if needed
    });

    it('should correctly process and set status for a proposal that fails', async () => {
      const mockProposalId = new mongoose.Types.ObjectId();
      const mockSquadId = new mongoose.Types.ObjectId();
      const mockFailedProposal: Partial<IProposal> = {
        _id: mockProposalId,
        squadId: mockSquadId,
        tokenName: 'Test Token Fail',
        squadName: 'Test Squad Fail',
        status: 'active',
        epochEnd: new Date(Date.now() - 100000),
        broadcasted: false,
        save: jest.fn().mockResolvedValue(this),
      };
      MockedProposal.find.mockResolvedValue([mockFailedProposal as IProposal]);

      const mockVotesFail: Partial<IVote>[] = [
        { choice: 'up', voterPointsAtCast: 100 },
        { choice: 'down', voterPointsAtCast: 600 },
      ];
      MockedVote.find.mockResolvedValue(mockVotesFail as IVote[]);
      
      MockedSquad.findById.mockResolvedValue({
        _id: mockSquadId,
        squadId: 'squad-fail-123',
        name: 'Test Squad Fail',
        memberWalletAddresses: ['wallet1'],
      } as ISquad);

      await processEndedProposals();

      expect(mockFailedProposal.save).toHaveBeenCalledTimes(1);
      expect(mockFailedProposal.status).toBe('closed_failed');
      expect(mockFailedProposal.finalUpVotesWeight).toBe(100);
      expect(mockFailedProposal.finalDownVotesWeight).toBe(600);
      expect(MockedNotification.insertMany).toHaveBeenCalled();
    });
  });

  describe('archiveOldClosedProposals', () => {
    it('should archive proposals that are closed and older than CRON_PROPOSAL_ARCHIVE_DELAY_DAYS', async () => {
      await archiveOldClosedProposals();
      expect(MockedProposal.updateMany).toHaveBeenCalledWith(
        { 
          status: { $in: ['closed_passed', 'closed_failed', 'closed_executed'] }, 
          epochEnd: { $lt: expect.any(Date) } 
        },
        { $set: { status: 'archived' } }
      );
    });
  });
}); 