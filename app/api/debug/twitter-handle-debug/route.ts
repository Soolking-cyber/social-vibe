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

    // Get all users from database for debugging
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('*');

    console.log('📊 All users in database:', allUsers);

    // Try to find current user
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${session.user.email},name.eq.${session.user.email || session.user.name}`)
      .single();

    console.log('👤 Current user lookup:', { currentUser, currentUserError });

    return NextResponse.json({
      session: {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image
      },
      allUsers,
      currentUser,
      errors: {
        allUsersError,
        currentUserError
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}