import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export interface TimeoutOptions {
  timeoutMs?: number;
  warnThresholdMs?: number;
}

export function withTimeout(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>,
  options: TimeoutOptions = {}
) {
  const { 
    timeoutMs = 9000, // 9 seconds default (1s buffer before Vercel's 10s)
    warnThresholdMs = 5000 // Warn if takes longer than 5s
  } = options;

  return async (req: NextRequest, context?: any) => {
    const startTime = Date.now();
    const path = req.nextUrl.pathname;
    
    // Create timeout promise
    const timeoutPromise = new Promise<NextResponse>((_, reject) => {
      setTimeout(() => {
        const duration = Date.now() - startTime;
        console.error(`[Timeout] Function ${path} timed out after ${duration}ms`);
        reject(new Error(`Function timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Create warning timeout
    const warnTimeout = setTimeout(() => {
      const duration = Date.now() - startTime;
      console.warn(`[Performance] Function ${path} is taking long: ${duration}ms`);
    }, warnThresholdMs);

    try {
      // Race between handler and timeout
      const response = await Promise.race([
        handler(req, context),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      // Log slow functions
      if (duration > 3000) {
        console.warn(`[Performance] Slow function ${path}: ${duration}ms`);
      }
      
      // Add timing headers
      response.headers.set('X-Function-Duration', duration.toString());
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Function Error] ${path} failed after ${duration}ms:`, error);
      
      if (error instanceof Error && error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Function timeout - operation took too long' },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    } finally {
      clearTimeout(warnTimeout);
    }
  };
}