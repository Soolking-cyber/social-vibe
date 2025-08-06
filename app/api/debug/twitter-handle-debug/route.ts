import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 DEBUG: Session data:', {
      email: session.user.email,
      name: session.user.name,
      image: session.user.image
    });

    // Test Supabase connection
    console.log('🔗 Testing Supabase connection...');
    
    // Get all users from database for debugging
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('*');

    console.log('📊 All users in database:', allUsers);
    console.log('❌ All users error:', allUsersError);

    // Try to find current user with multiple methods
    const queries = [
      { method: 'email', query: supabase.from('users').select('*').eq('email', session.user.email) },
      { method: 'name', query: supabase.from('users').select('*').eq('name', session.user.name) },
      { method: 'name_as_email', query: supabase.from('users').select('*').eq('name', session.user.email) }
    ];

    const results: Record<string, any> = {};
    for (const { method, query } of queries) {
      const { data, error } = await query.single();
      results[method] = { data, error };
      console.log(`🔍 Query ${method}:`, { data, error });
    }

    return NextResponse.json({
      session: {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image
      },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      allUsers,
      allUsersError,
      queryResults: results
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}