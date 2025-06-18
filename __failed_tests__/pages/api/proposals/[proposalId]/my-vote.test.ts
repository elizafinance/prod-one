import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/proposals/[proposalId]/my-vote';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/lib/mongodb';
import { Vote } from '@/models/Vote';
import { Types } from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/mongodb');
jest.mock('@/models/Vote');

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnectToDatabase = connectToDatabase as jest.Mock;
const MockedVote = Vote as jest.Mocked<typeof Vote>;

describe('/api/proposals/[proposalId]/my-vote', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;
  // Use "any" to avoid brittle type conflicts in test mocks
  let mockStatus: any;
  let mockJson: any;
  let mockEnd: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockEnd = jest.fn();
    mockStatus = jest.fn(() => ({ json: mockJson, end: mockEnd })) as any;
    mockRes = { status: mockStatus, setHeader: jest.fn() as any };

    (mockConnectToDatabase as any).mockResolvedValue({ db: {} });

    (mockGetServerSession as any).mockResolvedValue({
      user: { dbId: new Types.ObjectId().toString(), walletAddress: 'wallet' },
    });

    // @ts-ignore
    MockedVote.findOne = jest.fn().mockReturnValue({ lean: jest.fn() });
  });

  it('should return 401 if unauthenticated', async () => {
    (mockGetServerSession as any).mockResolvedValueOnce(null);
    mockReq = { method: 'GET', query: { proposalId: new Types.ObjectId().toString() } };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('should return 400 for invalid proposal ID', async () => {
    mockReq = { method: 'GET', query: { proposalId: 'bad' } };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('should return vote data when present', async () => {
    const voteRecord = { choice: 'up', createdAt: new Date() };
    // @ts-ignore
    MockedVote.findOne().lean.mockResolvedValueOnce(voteRecord);
    const pid = new Types.ObjectId().toString();
    mockReq = { method: 'GET', query: { proposalId: pid } };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ vote: voteRecord });
  });

  it('should return vote null when not found', async () => {
    // @ts-ignore
    MockedVote.findOne().lean.mockResolvedValueOnce(null);
    mockReq = { method: 'GET', query: { proposalId: new Types.ObjectId().toString() } };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ vote: null });
  });

  it('should return 405 on non-GET methods', async () => {
    mockReq = { method: 'POST', query: { proposalId: new Types.ObjectId().toString() } };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(405);
  });
}); 