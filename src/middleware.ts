import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths that don't require authentication
  const publicPaths = [
    '/leaderboard',
  ]

  // Allow public routes and Next.js internals
  if (
    publicPaths.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Allow unauthenticated access to root so login page can render
  if (pathname === '/') {
    return NextResponse.next()
  }

  try {
    const token = await getToken({ req: request })

    // Redirect non-admin access to admin pages
    if (pathname.startsWith('/admin')) {
      // Check if token exists and has admin role
      const isAdmin = token && (
        token.role === 'admin' || 
        (token as any)?.user?.role === 'admin'
      );
      
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      return NextResponse.next()
    }

    // Require authentication for all other routes
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
  } catch (error) {
    console.error('[Middleware] Error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
} 