import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAdminToken } from '@/lib/adminUtils'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const { pathname } = request.nextUrl

  // Public paths
  const publicPaths = [
    '/leaderboard',
  ]

  // Allow public routes and Next.js internals
  if (
    publicPaths.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/stats') || // Public statistics endpoints
    pathname.startsWith('/api/users/points') || // Public endpoint to fetch points for any wallet
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Allow unauthenticated access to root so login page can render
  if (pathname === '/') {
    return NextResponse.next()
  }

  // Redirect non-admin access to admin pages
  if (pathname.startsWith('/admin')) {
    console.log('[Middleware] Admin route check - Full Token:', JSON.stringify(token, null, 2));
    console.log('[Middleware] Token walletAddress:', token?.walletAddress);
    console.log('[Middleware] Token user:', token?.user);
    console.log('[Middleware] Token dbId:', token?.dbId);
    
    // Check if token exists and wallet address is admin
    const isAdmin = token && isAdminToken(token);
    
    if (!isAdmin) {
      console.log('[Middleware] Access denied - Wallet not in admin list');
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }
    console.log('[Middleware] Admin access granted for wallet:', token.walletAddress);
    return NextResponse.next()
  }

  // Require authentication for all other routes
  if (!token) {
    const url = new URL('/', request.url)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Configure which paths the middleware should run on
export const config = {
  matcher: '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
} 