import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { twitterHandle } = await request.json();

    if (!twitterHandle) {
      return NextResponse.json({ error: 'Twitter handle is required' }, { status: 400 });
    }

    // Clean the Twitter handle
    const cleanHandle = twitterHandle.replace('@', '').replace(/[^a-zA-Z0-9_]/g, '');

    if (cleanHandle.length === 0) {
      return NextResponse.json({ error: 'Invalid Twitter handle' }, { status: 400 });
    }

    const userIdentifier = session.user.email || session.user.name;

    // Update user's Twitter handle
    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({ twitter_handle: cleanHandle })
      .eq('name', userIdentifier)
      .select('id, twitter_handle')
      .single();

    if (updateError) {
      console.error('Error updating Twitter handle:', updateError);
      return NextResponse.json({ error: 'Failed to update Twitter handle' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      twitterHandle: user.twitter_handle,
      message: 'Twitter handle updated successfully'
    });

  } catch (error) {
    console.error('Error updating Twitter handle:', error);
    return NextResponse.json({ error: 'Failed to update Twitter handle' }, { status: 500 });
  }
}