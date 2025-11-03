// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight middleware - only checks if Better-Auth cookie exists
 * Full session validation happens in layouts/routes
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Define public routes
  const publicRoutes = ["/", "/signin", "/signup"];
  const isPublicRoute = publicRoutes.some((route) => pathname === route);
  const isAuthAPI = pathname.startsWith("/api/auth");

  // Allow public routes and auth API
  if (isPublicRoute || isAuthAPI) {
    return NextResponse.next();
  }

  // Check for Better-Auth session cookie
  // Better-Auth typically uses cookies with names like:
  // - better-auth.session_token
  // - better_auth_session
  // Let's check all cookies for any that contain session info
  
  const cookies = request.cookies;
  const hasBetterAuthCookie = 
    cookies.has('better-auth.session_token') ||
    cookies.has('better_auth.session') ||
    cookies.has('auth.session_token') ||
    Array.from(cookies.getAll()).some(cookie => 
      cookie.name.includes('better-auth') || 
      cookie.name.includes('session')
    );

  if (!hasBetterAuthCookie) {
    console.log(`❌ No Better-Auth cookie for: ${pathname}`);
    console.log('Available cookies:', Array.from(cookies.getAll()).map(c => c.name));
    
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  console.log(`✅ Better-Auth cookie exists for: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};