import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl
    
    // Skip middleware for static files and API routes that don't need auth
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/_vercel') ||
      pathname.startsWith('/api/auth') ||
      pathname === '/favicon.ico' ||
      pathname.startsWith('/login')
    ) {
      return NextResponse.next()
    }
    
    // For now, allow all requests to pass through
    // Authentication will be handled at the component level
    return NextResponse.next()
    
  } catch (error) {
    console.error('Middleware error:', error)
    // On any error, allow the request to continue
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _vercel (Vercel internal routes)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|_vercel|favicon.ico).*)',
  ],
}