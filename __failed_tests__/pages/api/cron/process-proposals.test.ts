import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/cron/process-proposals';
import { main as runProposalCron } from '@/scripts/cron/processProposals';

jest.mock('@/scripts/cron/processProposals', () => ({
  main: jest.fn().mockResolvedValue(undefined),
}));

const mockedRunCron: any = runProposalCron as any;

describe('/api/cron/process-proposals', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;
  let mockStatus: any;
  let mockJson: any;
  let mockEnd: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockEnd = jest.fn();
    mockStatus = jest.fn(() => ({ json: mockJson, end: mockEnd })) as any;
    mockRes = { status: mockStatus, setHeader: jest.fn() as any };
  });

  it('should return 405 for non-POST', async () => {
    mockReq = { method: 'GET' };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(405);
  });

  it('should execute cron and return 200', async () => {
    mockReq = { method: 'POST' };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockedRunCron).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('should return 500 on cron error', async () => {
    (mockedRunCron as any).mockRejectedValueOnce(new Error('fail'));
    mockReq = { method: 'POST' };
    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);
    expect(mockStatus).toHaveBeenCalledWith(500);
  });
}); 