// __tests__/pages/api/proposals/[proposalId]/vote.test.ts
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/proposals/[proposalId]/vote';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/lib/mongodb';
import { Proposal } from '@/models/Proposal';
import { Vote } from '@/models/Vote';
import { Squad } from '@/models/Squad';
import { Types } from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/mongodb');
jest.mock('@/models/Proposal');
jest.mock('@/models/Vote');
jest.mock('@/models/Squad');

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnectToDatabase = connectToDatabase as jest.Mock;
const MockedProposal = Proposal as jest.Mocked<typeof Proposal>;
const MockedVote = Vote as jest.Mocked<typeof Vote>;
const MockedSquad = Squad as jest.Mocked<typeof Squad>;

describe('/api/proposals/[proposalId]/vote', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;
  let mockEnd: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockEnd = jest.fn();
    mockStatus = jest.fn(() => ({ json: mockJson, end: mockEnd }));
    mockRes = { status: mockStatus };

    // Default mock implementations
    mockGetServerSession.mockResolvedValue({
      user: { dbId: new Types.ObjectId().toString(), walletAddress: 'testWalletAddress' },
    });
    mockConnectToDatabase.mockResolvedValue({ db: {} }); // Mock db connection
    
    MockedProposal.findById = jest.fn().mockResolvedValue({
      _id: new Types.ObjectId(),
      squadId: new Types.ObjectId(),
      status: 'active',
      epochEnd: new Date(Date.now() + 100000), // Future date
      save: jest.fn().mockResolvedValue(true),
    });

    MockedSquad.findById = jest.fn().mockResolvedValue({
      _id: new Types.ObjectId(),
      memberWalletAddresses: ['testWalletAddress'],
    });

    // Mock usersCollection.findOne (part of connectToDatabase mock potentially)
    // This is tricky as it's a native driver call within the handler.
    // For a true unit test of the handler, connectToDatabase might return a mock db
    // which in turn returns a mock collection with a mock findOne.
    const mockUserCollection = {
        findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), points: 1000 })
    };
    const mockDb = { collection: jest.fn(() => mockUserCollection) };
    mockConnectToDatabase.mockResolvedValue({ db: mockDb } as any);

    MockedVote.findOne = jest.fn().mockResolvedValue(null); // Default to user hasn't voted
    MockedVote.find = jest.fn().mockResolvedValue([]); // For broadcast check
    // @ts-ignore
    MockedVote.prototype.save = jest.fn().mockResolvedValue({});
  });

  it('should prevent voting if user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    mockReq = { 
      method: 'POST', 
      query: { proposalId: new Types.ObjectId().toString() }, 
      body: { choice: 'up' },
      headers: {
        'x-wallet-sig': 'mockSig',
        'x-wallet-msg': 'mockMsg'
      }
    };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('User not authenticated') }));
  });

  it('should prevent voting with invalid proposal ID', async () => {
    mockReq = { 
      method: 'POST', 
      query: { proposalId: 'invalid-id' }, 
      body: { choice: 'up' },
      headers: {
        'x-wallet-sig': 'mockSig',
        'x-wallet-msg': 'mockMsg'
      }
    };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'Valid Proposal ID is required.' }));
  });

  it('should prevent voting with invalid choice', async () => {
    mockReq = { 
      method: 'POST', 
      query: { proposalId: new Types.ObjectId().toString() }, 
      body: { choice: 'maybe' },
      headers: {
        'x-wallet-sig': 'mockSig',
        'x-wallet-msg': 'mockMsg'
      }
    };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid vote choice. Must be one of: up, down, abstain.' }));
  });

  it('should prevent a user from voting twice (duplicate key error)', async () => {
    // @ts-ignore
    MockedVote.prototype.save.mockRejectedValueOnce({ code: 11000 }); 
    mockReq = { 
      method: 'POST', 
      query: { proposalId: new Types.ObjectId().toString() }, 
      body: { choice: 'up' },
      headers: {
        'x-wallet-sig': 'mockSignatureForDuplicateTest',
        'x-wallet-msg': 'mockMessageForDuplicateTest'
      }
    };
    
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    
    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'You have already voted on this proposal.' }));
  });

  it('should allow a valid vote', async () => {
    const proposalId = new Types.ObjectId();
    mockReq = { 
      method: 'POST', 
      query: { proposalId: proposalId.toString() }, 
      body: { choice: 'up' },
      headers: {
        'x-wallet-sig': 'mockSignatureForValidVote',
        'x-wallet-msg': 'mockMessageForValidVote'
      } 
    };
    
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    
    expect(MockedVote.prototype.save).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledWith(201);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Vote cast successfully!' }));
  });

  // Add more tests:
  // - Voter not found in users collection (e.g., points check fails due to no user)
  // - User has insufficient points
  // - Proposal not found
  // - Proposal not active
  // - Voting period ended
  // - Voter not a member of the squad
  // - Broadcast threshold met and proposal marked
}); 