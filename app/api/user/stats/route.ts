import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { walletService } from '@/lib/wallet';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface User {
  id: string;
  balance: number;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log('Stats API - Session:', session); // Debug log

    // Type guard to ensure session and user exist
    if (!session || !session.user) {
      console.log('Stats API - No session or user found'); // Debug log
      return NextResponse.json({ error: 'Unauthorized - No session found' }, { status: 401 });
    }

    // Use email or name as identifier
    const userIdentifier = session.user.email || session.user.name;
    
    if (!userIdentifier) {
      console.log('Stats API - No user identifier found'); // Debug log
      return NextResponse.json({ error: 'Unable to identify user' }, { status: 401 });
    }
    
    console.log('Stats API - Looking for user with identifier:', userIdentifier);
    
    // Try to find user by name first (since Twitter provides name, not always email)
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id, balance, wallet_address, eth_balance, usdc_balance, twitter_handle')
      .eq('name', userIdentifier)
      .single();
      
    // If not found by name, try by email
    if (userError && userError.code === 'PGRST116' && session.user.email) {
      const { data: userByEmail, error: emailError } = await supabase
        .from('users')
        .select('id, balance, wallet_address, eth_balance, usdc_balance, twitter_handle')
        .eq('email', session.user.email)
        .single();
        
      if (!emailError) {
        user = userByEmail;
        userError = null;
      }
    }
      
    console.log('Stats API - User query result:', { user, userError });

    // If user doesn't exist, create them with wallet
    if (userError && userError.code === 'PGRST116') {
      // Generate wallet for new user
      const wallet = walletService.generateWallet();
      
      // Capture Twitter handle from session if available
      const twitterHandle = (session.user as any).twitterHandle;
      console.log('Creating new user with Twitter handle:', twitterHandle);

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: session.user.email || `${session.user.name}@twitter.local`,
          name: session.user.name || userIdentifier,
          image: session.user.image || null,
          twitter_handle: twitterHandle || null,
          balance: 10.00, // Give new users $10 to start
          wallet_address: wallet.address,
          wallet_private_key: walletService.encrypt(wallet.privateKey),
          wallet_mnemonic: walletService.encrypt(wallet.mnemonic),
          eth_balance: 0.0,
          usdc_balance: 0.0
        })
        .select('id, balance, wallet_address, eth_balance, usdc_balance, twitter_handle')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }

      user = newUser;
    } else if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Ensure user exists after creation/fetch
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get total earned from job completions
    const { data: completions, error: completionsError } = await supabase
      .from('job_completions')
      .select('reward_amount')
      .eq('user_id', user.id);

    const totalEarned = completions?.reduce((sum, completion) => {
      const amount = typeof completion.reward_amount === 'string'
        ? parseFloat(completion.reward_amount)
        : completion.reward_amount;
      return sum + amount;
    }, 0) || 0;

    // Get jobs created count
    const { count: jobsCreated, error: jobsCreatedError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Get jobs completed count
    const { count: jobsCompleted, error: jobsCompletedError } = await supabase
      .from('job_completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Parse balance safely
    const balance = typeof user.balance === 'string' ? parseFloat(user.balance) : user.balance;
    
    // Use cached wallet balances (don't fetch fresh every time)
    let walletBalances = { eth: '0.0', usdc: '0.0' };
    if (user.wallet_address) {
      // Use cached balances from database
      walletBalances = {
        eth: user.eth_balance?.toString() || '0.0',
        usdc: user.usdc_balance?.toString() || '0.0'
      };
    }

    // Calculate earned balance from completed jobs (not stored field)
    const earnedBalance = totalEarned;
    const canWithdraw = earnedBalance >= 10.0;

    return NextResponse.json({
      balance,
      totalEarned,
      earnedBalance: earnedBalance,
      canWithdraw: canWithdraw,
      withdrawalThreshold: 10.0,
      jobsCreated: jobsCreated || 0,
      jobsCompleted: jobsCompleted || 0,
      twitterHandle: user.twitter_handle || null,
      wallet: user.wallet_address ? {
        address: user.wallet_address,
        balances: walletBalances
      } : null
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
  }
}