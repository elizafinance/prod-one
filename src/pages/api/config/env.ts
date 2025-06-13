import { NextApiRequest, NextApiResponse } from 'next';

// Explicit allowlist of variables that are safe to expose
const ALLOWED_ENV_VARS = [
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS', 
  'NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT',
  'NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS',
] as const;

// Enhanced rate limiting with better tracking
interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
  suspicious: boolean;
}

const requestCounts = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 5; // Reduced from 10 - more restrictive
const RATE_WINDOW = 60 * 1000; // 1 minute
const SUSPICIOUS_THRESHOLD = 20; // Flag as suspicious after this many requests

// Security logging function
function securityLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'env-api',
    message,
    ...metadata
  };
  
  if (level === 'ERROR' || level === 'WARN') {
    console.error('[SECURITY]', JSON.stringify(logEntry));
  } else {
    console.log('[SECURITY]', JSON.stringify(logEntry));
  }
}

function isRateLimited(ip: string, userAgent?: string): { limited: boolean; suspicious: boolean } {
  const now = Date.now();
  const userRequests = requestCounts.get(ip);

  if (!userRequests || now > userRequests.resetTime) {
    // Reset or initialize
    requestCounts.set(ip, { 
      count: 1, 
      resetTime: now + RATE_WINDOW,
      firstRequest: now,
      suspicious: false
    });
    return { limited: false, suspicious: false };
  }

  userRequests.count++;
  
  // Check for suspicious behavior
  if (userRequests.count > SUSPICIOUS_THRESHOLD) {
    userRequests.suspicious = true;
    securityLog('WARN', 'Suspicious rate limit activity detected', {
      ip,
      userAgent,
      requestCount: userRequests.count,
      timeWindow: now - userRequests.firstRequest
    });
  }

  return { 
    limited: userRequests.count > RATE_LIMIT, 
    suspicious: userRequests.suspicious 
  };
}

// Validate request origin for CSRF protection
function isValidOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  // Allow same-origin requests
  if (origin && host && origin.includes(host)) {
    return true;
  }
  
  if (referer && host && referer.includes(host)) {
    return true;
  }
  
  // Allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    const allowedOrigins = ['localhost', '127.0.0.1'];
    if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
      return true;
    }
  }
  
  return false;
}

// Enhanced error response that doesn't leak information
function sendErrorResponse(res: NextApiResponse, status: number, message: string, clientIP?: string) {
  securityLog('WARN', 'API request rejected', {
    status,
    message,
    clientIP,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose internal error details
  const publicMessage = status === 429 ? 'Rate limit exceeded' : 
                       status === 403 ? 'Forbidden' :
                       status === 401 ? 'Unauthorized' : 'Bad request';
                       
  res.status(status).json({ 
    error: publicMessage,
    timestamp: new Date().toISOString()
  });
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  
  try {
    // Feature flag: Disable this workaround in production when Next.js bug is fixed
    const isWorkaroundEnabled = process.env.ENABLE_ENV_API_WORKAROUND !== 'false';
    
    if (!isWorkaroundEnabled) {
      return sendErrorResponse(res, 404, 'Endpoint disabled');
    }

    // OWASP: Validate HTTP method
    if (req.method !== 'GET') {
      return sendErrorResponse(res, 405, 'Method not allowed');
    }

    // OWASP: Extract client information for monitoring
    const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                     (req.headers['x-real-ip'] as string) ||
                     req.socket.remoteAddress || 
                     'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const origin = req.headers.origin || 'unknown';

    // OWASP: Origin validation for CSRF protection
    if (!isValidOrigin(req)) {
      securityLog('WARN', 'Invalid origin detected', { clientIP, origin, userAgent });
      return sendErrorResponse(res, 403, 'Invalid origin', clientIP);
    }

    // OWASP: Enhanced rate limiting with suspicious activity detection
    const rateLimitResult = isRateLimited(clientIP, userAgent);
    
    if (rateLimitResult.suspicious) {
      // Additional logging for suspicious activity but don't block yet
      securityLog('ERROR', 'Suspicious activity - possible attack', {
        clientIP,
        userAgent,
        origin
      });
    }
    
    if (rateLimitResult.limited) {
      return sendErrorResponse(res, 429, 'Rate limit exceeded', clientIP);
    }

    // OWASP: Input validation (minimal since we don't accept inputs)
    const queryParams = Object.keys(req.query);
    if (queryParams.length > 0) {
      securityLog('WARN', 'Unexpected query parameters', { clientIP, queryParams });
      // Allow but log - could be legitimate caching busters
    }

    // OWASP: Secure headers
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); 
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    
    // OWASP: CORS headers
    if (origin && origin !== 'unknown') {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '300');

    // OWASP: Only return explicitly allowed environment variables
    const envVars: Record<string, string> = {};
    let missingVars = 0;
    
    ALLOWED_ENV_VARS.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        envVars[varName] = value;
      } else {
        missingVars++;
      }
    });

    // OWASP: Security monitoring and alerting
    if (missingVars > 0) {
      securityLog('ERROR', 'Missing environment variables detected', {
        missingCount: missingVars,
        totalExpected: ALLOWED_ENV_VARS.length
      });
    }

    // OWASP: Audit logging for successful requests
    const processingTime = Date.now() - startTime;
    securityLog('INFO', 'Environment variables served', {
      clientIP,
      userAgent: userAgent.substring(0, 100), // Truncate to prevent log injection
      origin,
      variablesServed: Object.keys(envVars).length,
      processingTimeMs: processingTime,
      suspicious: rateLimitResult.suspicious
    });

    // OWASP: Validate response before sending
    if (Object.keys(envVars).length === 0) {
      return sendErrorResponse(res, 500, 'No environment variables available', clientIP);
    }

    return res.status(200).json(envVars);

  } catch (error) {
    // OWASP: Error handling that doesn't expose internals
    securityLog('ERROR', 'Unhandled error in env API', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error as Error)?.stack : undefined
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
} 