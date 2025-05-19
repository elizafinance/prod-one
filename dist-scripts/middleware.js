import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
export async function middleware(request) {
    var _a;
    const token = await getToken({ req: request });
    const { pathname } = request.nextUrl;
    // Public paths
    const publicPaths = [
        '/leaderboard',
    ];
    // Allow public routes and Next.js internals
    if (publicPaths.includes(pathname) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname.includes('.') // static files
    ) {
        return NextResponse.next();
    }
    // Allow unauthenticated access to root so login page can render
    if (pathname === '/') {
        return NextResponse.next();
    }
    // Redirect non-admin access to admin pages
    if (pathname.startsWith('/admin')) {
        console.log('[Middleware] Admin route check - Full Token:', JSON.stringify(token, null, 2));
        console.log('[Middleware] Token role:', token === null || token === void 0 ? void 0 : token.role);
        console.log('[Middleware] Token user:', token === null || token === void 0 ? void 0 : token.user);
        console.log('[Middleware] Token dbId:', token === null || token === void 0 ? void 0 : token.dbId);
        // Check if token exists and has admin role
        const isAdmin = token && (token.role === 'admin' ||
            ((_a = token === null || token === void 0 ? void 0 : token.user) === null || _a === void 0 ? void 0 : _a.role) === 'admin' ||
            (token === null || token === void 0 ? void 0 : token.role) === 'admin');
        if (!isAdmin) {
            console.log('[Middleware] Access denied - Not admin');
            const url = new URL('/', request.url);
            return NextResponse.redirect(url);
        }
        console.log('[Middleware] Admin access granted');
        return NextResponse.next();
    }
    // Require authentication for all other routes
    if (!token) {
        const url = new URL('/', request.url);
        return NextResponse.redirect(url);
    }
    return NextResponse.next();
}
// Configure which paths the middleware should run on
export const config = {
    matcher: '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
};
