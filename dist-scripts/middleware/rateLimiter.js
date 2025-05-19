import { NextResponse } from 'next/server';
const ipBuckets = new Map();
export function withRateLimit(handler, options = { windowMs: 30000, max: 20 }) {
    return async function (request) {
        var _a;
        const ip = ((_a = request.headers.get('x-forwarded-for')) === null || _a === void 0 ? void 0 : _a.split(',')[0].trim()) || 'unknown';
        const now = Date.now();
        const bucket = ipBuckets.get(ip);
        if (!bucket) {
            ipBuckets.set(ip, { count: 1, firstRequestTs: now });
        }
        else {
            if (now - bucket.firstRequestTs > options.windowMs) {
                bucket.count = 1;
                bucket.firstRequestTs = now;
            }
            else {
                bucket.count += 1;
            }
            if (bucket.count > options.max) {
                return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
            }
        }
        return handler(request);
    };
}
