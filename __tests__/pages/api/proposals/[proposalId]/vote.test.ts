// __tests__/pages/api/proposals/[proposalId]/vote.test.ts
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/proposals/[proposalId]/vote';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/lib/mongodb';
import { Proposal } from '@/models/Proposal';
import { Vote } from '@/models/Vote';
import { Squad } from '@/models/Squad';
import { User } from '@/models/User';
import { Types } from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/mongodb');
jest.mock('@/models/Proposal');
jest.mock('@/models/Vote');
jest.mock('@/models/Squad');
jest.mock('@/models/User');

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnectToDatabase = connectToDatabase as jest.Mock;
const MockedProposal = Proposal as jest.Mocked<typeof Proposal>;
const MockedVote = Vote as jest.Mocked<typeof Vote>;
const MockedSquad = Squad as jest.Mocked<typeof Squad>;
const MockedUser = User as jest.Mocked<typeof User>;

describe('/api/proposals/[proposalId]/vote', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;
  let mockEnd: jest.Mock;

  const mockProposalId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();
  const mockUserWalletAddress = 'testWalletAddress';

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockEnd = jest.fn();
    mockStatus = jest.fn(() => ({ json: mockJson, end: mockEnd }));
    mockRes = { status: mockStatus as any }; 

    // @ts-ignore
    mockGetServerSession.mockResolvedValue({
      user: { dbId: mockUserId.toString(), walletAddress: mockUserWalletAddress, name: 'Test User' },
    });
    
    const mockUserCollection = {
        // @ts-ignore
        findOne: jest.fn().mockResolvedValue({ _id: mockUserId, points: 1000, walletAddress: mockUserWalletAddress}),
        // @ts-ignore
        insertOne: jest.fn().mockResolvedValue({ acknowledged: true, insertedId: new Types.ObjectId() })
    };
    const mockDb = { 
        // @ts-ignore
        collection: jest.fn().mockImplementation((name: string) => {
            if (name === 'users') return mockUserCollection;
            return { findOne: jest.fn(), insertOne: jest.fn(), find: jest.fn().mockReturnThis(), toArray: jest.fn().mockResolvedValue([]) }; 
        })
    };
    // @ts-ignore
    mockConnectToDatabase.mockResolvedValue({ client: {}, db: mockDb });

    // @ts-ignore
    (MockedProposal.findById as jest.Mock).mockResolvedValue(null);
    // @ts-ignore
    (MockedProposal.findOne as jest.Mock).mockResolvedValue(null);
    // @ts-ignore
    MockedProposal.prototype.save = jest.fn().mockResolvedValue(true);

    // @ts-ignore
    (MockedSquad.findById as jest.Mock).mockResolvedValue({
      _id: new Types.ObjectId(),
      memberWalletAddresses: [mockUserWalletAddress],
    });
    
    const mockUserInstance = {
        _id: mockUserId,
        points: 1000,
        walletAddress: mockUserWalletAddress,
        xUserId: 'test-xid',
        xUsername: 'Test User',
        toObject: () => ({ _id: mockUserId, points: 1000, walletAddress: mockUserWalletAddress }),
        save: jest.fn().mockResolvedValue(true)
    };
    // @ts-ignore
    (MockedUser.findById as jest.Mock).mockResolvedValue(mockUserInstance);
    // @ts-ignore
    (MockedUser.findOne as jest.Mock).mockResolvedValue(mockUserInstance);
    // @ts-ignore
    MockedUser.prototype.save = jest.fn().mockResolvedValue(mockUserInstance);
    
    // @ts-ignore
    (MockedVote.findOne as jest.Mock).mockResolvedValue(null); 
    // @ts-ignore
    (MockedVote.find as jest.Mock).mockResolvedValue([]); 
    // @ts-ignore
    MockedVote.prototype.save = jest.fn().mockResolvedValue({ choice: 'up' }); 
  });

  it('should prevent voting if user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    mockReq = { 
      method: 'POST', 
      query: { proposalId: mockProposalId.toString() }, 
      body: { choice: 'up' },
      headers: { 'x-wallet-sig': 'mockSig', 'x-wallet-msg': JSON.stringify({ proposalId: mockProposalId.toString(), choice: 'up', voter: mockUserWalletAddress}) }
    };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('User not authenticated') }));
  });

  it('should return 404 for a non-existent (but valid slug format) proposal ID', async () => {
    const nonExistentValidSlug = 'this-is-a-valid-slug-but-not-found';
    mockReq = { 
      method: 'POST', 
      query: { proposalId: nonExistentValidSlug }, 
      body: { choice: 'up' },
      headers: { 'x-wallet-sig': 'mockSig', 'x-wallet-msg': JSON.stringify({ proposalId: nonExistentValidSlug, choice: 'up', voter: mockUserWalletAddress}) }
    };
    (MockedProposal.findOne as jest.Mock).mockResolvedValue(null);
    (MockedProposal.findById as jest.Mock).mockResolvedValue(null); 

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'Proposal not found.' }));
  });

  it('should return 400 for a syntactically malformed proposal ID', async () => {
    const malformedId = 'not a valid id !@#$'; 
    mockReq = { 
      method: 'POST', 
      query: { proposalId: malformedId }, 
      body: { choice: 'up' },
      headers: { 'x-wallet-sig': 'mockSig', 'x-wallet-msg': JSON.stringify({ proposalId: malformedId, choice: 'up', voter: mockUserWalletAddress}) }
    };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'Valid Proposal ID is required.' }));
  });

  it('should prevent voting with invalid choice', async () => {
    mockReq = { 
      method: 'POST', 
      query: { proposalId: mockProposalId.toString() }, 
      body: { choice: 'maybe' },
      headers: { 'x-wallet-sig': 'mockSig', 'x-wallet-msg': JSON.stringify({ proposalId: mockProposalId.toString(), choice: 'maybe', voter: mockUserWalletAddress}) }
    };
    (MockedProposal.findById as jest.Mock).mockResolvedValueOnce({
        _id: mockProposalId,
        squadId: new Types.ObjectId(),
        status: 'active',
        epochEnd: new Date(Date.now() + 100000), 
        save: jest.fn().mockResolvedValue(true),
    });

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid vote choice. Must be one of: up, down, abstain.' }));
  });

  it('should prevent a user from voting twice (duplicate key error)', async () => {
    MockedVote.prototype.save.mockRejectedValueOnce({ code: 11000 }); 
    mockReq = { 
      method: 'POST', 
      query: { proposalId: mockProposalId.toString() }, 
      body: { choice: 'up' },
      headers: {
        'x-wallet-sig': 'mockSignatureForDuplicateTest',
        'x-wallet-msg': JSON.stringify({ proposalId: mockProposalId.toString(), choice: 'up', voter: mockUserWalletAddress})
      }
    };
    (MockedProposal.findById as jest.Mock).mockResolvedValueOnce({
        _id: mockProposalId,
        squadId: new Types.ObjectId(),
        status: 'active',
        epochEnd: new Date(Date.now() + 100000),
        save: jest.fn().mockResolvedValue(true),
    });
    
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    
    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'You have already voted on this proposal.' }));
  });

  it('should allow a valid vote', async () => {
    mockReq = { 
      method: 'POST', 
      query: { proposalId: mockProposalId.toString() }, 
      body: { choice: 'up' },
      headers: {
        'x-wallet-sig': 'mockSignatureForValidVote',
        'x-wallet-msg': JSON.stringify({ proposalId: mockProposalId.toString(), choice: 'up', voter: mockUserWalletAddress})
      } 
    };
    (MockedProposal.findById as jest.Mock).mockResolvedValueOnce({
        _id: mockProposalId,
        squadId: new Types.ObjectId(),
        status: 'active',
        epochEnd: new Date(Date.now() + 100000),
        broadcasted: false, 
        save: jest.fn().mockResolvedValue(true),
    });
    
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    
    expect(MockedVote.prototype.save).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledWith(201);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Vote cast successfully!' }));
  });

}); 