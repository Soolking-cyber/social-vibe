import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Retrieve user's Twitter handle securely from database
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;
    
    // Fetch Twitter handle from database (never from Twitter API)
    const { data: user, error } = await supabase
      .from('users')
      .select('twitter_handle, name, email')
      .eq('name', userIdentifier)
      .single();

    if (error) {
      console.error('Error fetching Twitter handle:', error);
      return NextResponse.json({ error: 'Failed to fetch Twitter handle' }, { status: 500 });
    }

    return NextResponse.json({
      twitterHandle: user?.twitter_handle || null,
      hasTwitterHandle: !!user?.twitter_handle
    });

  } catch (error) {
    console.error('Error in Twitter handle GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update user's Twitter handle (admin/manual update only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { twitterHandle } = await request.json();

    if (!twitterHandle || typeof twitterHandle !== 'string') {
      return NextResponse.json({ error: 'Valid Twitter handle required' }, { status: 400 });
    }

    // Clean the handle
    const cleanHandle = twitterHandle.replace('@', '').trim();
    
    // Validate handle format
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(cleanHandle)) {
      return NextResponse.json({ 
        error: 'Invalid Twitter handle format. Must be 1-15 characters, letters/numbers/underscores only.' 
      }, { status: 400 });
    }

    const userIdentifier = session.user.email || session.user.name;
    
    // Update Twitter handle in database
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ twitter_handle: cleanHandle })
      .eq('name', userIdentifier)
      .select('twitter_handle')
      .single();

    if (error) {
      console.error('Error updating Twitter handle:', error);
      return NextResponse.json({ error: 'Failed to update Twitter handle' }, { status: 500 });
    }

    console.log(`✅ Twitter handle updated for user ${userIdentifier}: ${cleanHandle}`);

    return NextResponse.json({
      success: true,
      twitterHandle: updatedUser.twitter_handle,
      message: 'Twitter handle updated successfully'
    });

  } catch (error) {
    console.error('Error in Twitter handle POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}