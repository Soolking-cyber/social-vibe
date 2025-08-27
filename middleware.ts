// Middleware temporarily disabled to resolve Vercel deployment issues
// Authentication is handled at the component level via AuthWrapper

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Simply pass through all requests - no processing
  return NextResponse.next()
}

// Minimal matcher to avoid conflicts
export const config = {
  matcher: [],
}