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
        
        // Allow access to NextAuth API routes (authentication endpoints)
        if (pathname.startsWith('/api/auth')) {
          return true
        }
        
        // Public static assets
        const publicRoutes = [
          '/favicon.ico',
        ]
        
        if (publicRoutes.includes(pathname)) {
          return true
        }
        
        // All other routes require authentication
        // This includes:
        // - Core pages: /, /marketplace, /create-job
        // - API endpoints: /api/jobs, /api/user, /api/wallet, /api/verify-twitter-action
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