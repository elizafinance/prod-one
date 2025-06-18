// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { NextApiRequest, NextApiResponse } from 'next';
import cancelHandler from '@/pages/api/squads/join-requests/[requestId]/cancel';
import approveHandler from '@/pages/api/squads/join-requests/[requestId]/approve';
import { getServerSession } from 'next-auth/next';

// Re-use existing jest setup helpers
jest.mock('next-auth/next');

const mockGetServerSession = getServerSession as jest.Mock;

function createMockRes() {
  const json = jest.fn();
  const end = jest.fn();
  const status = jest.fn(() => ({ json, end }));
  const setHeader = jest.fn();
  return { status, setHeader } as unknown as NextApiResponse;
}

describe('Squad join-request routes basic validations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancel route → returns 405 for GET', async () => {
    const req = { method: 'GET', query: { requestId: 'abc' } } as unknown as NextApiRequest;
    const res = createMockRes();
    await cancelHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('cancel route → returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = { method: 'POST', query: { requestId: 'abc' } } as unknown as NextApiRequest;
    const res = createMockRes();
    await cancelHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('approve route → returns 400 when requestId missing', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { walletAddress: 'FAKE' } });
    const req = { method: 'POST', query: {} } as unknown as NextApiRequest;
    const res = createMockRes();
    await approveHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
}); 