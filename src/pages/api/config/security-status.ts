import { NextApiRequest, NextApiResponse } from 'next';

// Simple security status check for monitoring
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only allow in development or with specific admin key
  const isAuthorized = process.env.NODE_ENV === 'development' || 
                      req.headers.authorization === `Bearer ${process.env.ADMIN_SECURITY_KEY}`;

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const status = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    envApiEnabled: process.env.ENABLE_ENV_API_WORKAROUND !== 'false',
    securityFeatures: {
      rateLimiting: true,
      originValidation: true,
      securityHeaders: true,
      auditLogging: true,
      errorHandling: true,
      inputValidation: true
    },
    recommendations: [
      'Monitor logs for suspicious activity',
      'Consider Redis for production rate limiting', 
      'Set up alerting for security events',
      'Disable env API when Next.js bug is fixed'
    ]
  };

  return res.status(200).json(status);
} 