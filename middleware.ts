import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin'; // Assuming this path is correct for your admin SDK init

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tokenCookie = request.cookies.get('token');
  const token = tokenCookie?.value;

  const publicPaths = ['/login', '/signup', '/api/set-token']; // Add other public paths like /api routes if needed

  // Allow access to public paths and specific API routes without a token
  if (publicPaths.some(path => pathname.startsWith(path)) || pathname === '/' || pathname.startsWith('/api/public')) { // Added /api/public as an example public API path
    // If trying to access login/signup while already logged in, redirect to dashboard
    if ((pathname === '/login' || pathname === '/signup') && token) {
      try {
        await adminAuth.verifyIdToken(token);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } catch (error) {
        // Invalid token, allow access to login/signup
        // but clear the potentially invalid cookie
        const response = NextResponse.next();
        response.cookies.delete('token');
        return response;
      }
    }
    return NextResponse.next();
  }

  // For protected routes, check for token
  if (!token) {
    console.log('Middleware: No token found, redirecting to login for path:', pathname);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify the token using Firebase Admin SDK
    await adminAuth.verifyIdToken(token);
    // console.log('Middleware: Token verified, allowing access to', pathname);
    return NextResponse.next(); // Token is valid, proceed
  } catch (error) {
    console.error('Middleware: Invalid token for path:', pathname, error);
    // Token is invalid (e.g., expired, malformed)
    // Redirect to login and clear the invalid token cookie
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token'); // Clear the invalid cookie
    return response;
  }
}

export const runtime = 'nodejs'; // Force Node.js runtime to prevent 'node:process' error

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /api/public (example for public API routes that don't need auth)
     * It's often easier to list protected paths or use a more permissive matcher initially.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/public).*)', 
  ],
}; 