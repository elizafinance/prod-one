import { withRateLimit } from '../src/middleware/rateLimiter';

function createRequest(ip: string): Request {
  return new Request('http://localhost', {
    headers: { 'x-forwarded-for': ip },
    method: 'GET',
  });
}

describe('withRateLimit middleware', () => {
  it('returns 429 after exceeding limit', async () => {
    const baseHandler = jest.fn(async () => new Response('ok'));
    const limited = withRateLimit(baseHandler, { windowMs: 1000, max: 3 });

    const ip = '1.1.1.1';

    // first 3 should pass
    for (let i = 0; i < 3; i++) {
      const res = await limited(createRequest(ip));
      expect(res.status).toBe(200);
    }

    // 4th within window should fail
    const res = await limited(createRequest(ip));
    expect(res.status).toBe(429);
  });
}); 