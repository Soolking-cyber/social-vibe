import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // If user is authenticated and trying to access login page, redirect to home
    if (req.nextauth.token && req.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/', req.url))
    }
    
    // Allow the request to continue
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // Allow access to login page without authentication
        if (pathname === '/login') {
          return true
        }
        
        // Allow access to NextAuth API routes
        if (pathname.startsWith('/api/auth')) {
          return true
        }
        
        // Allow access to TwitterAPI.io proxy (needed for verification)
        if (pathname === '/api/twitterapi-io-proxy') {
          return true
        }
        
        // Public routes that don't require authentication
        const publicRoutes = [
          '/favicon.ico',
        ]
        
        if (publicRoutes.includes(pathname)) {
          return true
        }
        
        // For all other routes (pages and API), require authentication
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}