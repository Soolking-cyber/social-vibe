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

    console.log('🔍 Twitter handle API called with session:', {
      hasSession: !!session,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      userImage: session?.user?.image
    });

    if (!session?.user) {
      console.error('❌ No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to find user by email first, then by name
    let user = null;
    let error = null;

    if (session.user.email) {
      console.log('🔍 Trying email lookup for:', session.user.email);
      const { data, error: emailError } = await supabase
        .from('users')
        .select('twitter_handle, name, email')
        .eq('email', session.user.email)
        .single();
      
      console.log('📊 Email lookup result:', { data, error: emailError });
      
      if (!emailError && data) {
        user = data;
      } else {
        // Fallback to name-based lookup
        console.log('🔄 Trying name lookup for:', session.user.email || session.user.name);
        const { data: nameData, error: nameError } = await supabase
          .from('users')
          .select('twitter_handle, name, email')
          .eq('name', session.user.email || session.user.name)
          .single();
        
        console.log('📊 Name lookup result:', { data: nameData, error: nameError });
        user = nameData;
        error = nameError;
      }
    } else {
      // No email, try name lookup
      console.log('🔄 No email, trying name lookup for:', session.user.name);
      const { data, error: nameError } = await supabase
        .from('users')
        .select('twitter_handle, name, email')
        .eq('name', session.user.name)
        .single();
      
      console.log('📊 Name-only lookup result:', { data, error: nameError });
      user = data;
      error = nameError;
    }

    if (error) {
      console.error('Error fetching Twitter handle:', error);
      console.log('Session user:', { email: session.user.email, name: session.user.name });
      return NextResponse.json({ error: 'Failed to fetch Twitter handle' }, { status: 500 });
    }

    console.log('✅ Twitter handle lookup result:', { 
      userEmail: session.user.email, 
      userName: session.user.name,
      foundHandle: user?.twitter_handle,
      userData: user 
    });

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