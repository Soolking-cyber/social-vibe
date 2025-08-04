import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log(`=== ENVIRONMENT CHECK ===`);
  
  const envCheck = {
    nodeEnv: process.env.NODE_ENV,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasTwitterClientId: !!process.env.TWITTER_CLIENT_ID,
    hasTwitterClientSecret: !!process.env.TWITTER_CLIENT_SECRET,
    hasTwitterBearer: !!process.env.TWITTER_BEARER_TOKEN,
    supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    supabaseKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    twitterBearerLength: process.env.TWITTER_BEARER_TOKEN?.length || 0
  };

  console.log('Environment variables check:', envCheck);

  return NextResponse.json({
    success: true,
    environment: envCheck,
    timestamp: new Date().toISOString()
  });
}