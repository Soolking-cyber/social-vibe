import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;

    if (!userIdentifier) {
      return NextResponse.json({
        error: 'Unable to identify user'
      }, { status: 401 });
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    // Calculate earned balance from completed jobs
    const { data: completions } = await supabase
      .from('job_completions')
      .select('reward_amount')
      .eq('user_id', user.id);

    const earnedBalance = completions?.reduce((sum, completion) => {
      const amount = typeof completion.reward_amount === 'string'
        ? parseFloat(completion.reward_amount)
        : completion.reward_amount;
      return sum + amount;
    }, 0) || 0;

    const withdrawalThreshold = 10.0;

    // Check minimum withdrawal amount
    if (earnedBalance < withdrawalThreshold) {
      return NextResponse.json({
        error: `Minimum withdrawal amount is ${withdrawalThreshold} USDC. Current earned balance: ${earnedBalance.toFixed(2)} USDC`
      }, { status: 400 });
    }

    console.log(`=== EARNINGS WITHDRAWAL FOR USER: ${userIdentifier} ===`);
    console.log(`Earned balance: ${earnedBalance} USDC`);

    // Transfer earned balance to user's USDC balance
    const currentUsdcBalance = parseFloat(user.usdc_balance?.toString() || '0');
    const newUsdcBalance = currentUsdcBalance + earnedBalance;

    // Update user's USDC balance
    await supabase
      .from('users')
      .update({
        usdc_balance: newUsdcBalance,
        last_balance_update: new Date().toISOString()
      })
      .eq('id', user.id);

    // Clear job completions after successful withdrawal (they've been "cashed out")
    await supabase
      .from('job_completions')
      .delete()
      .eq('user_id', user.id);

    // Record withdrawal transaction for tracking
    await supabase
      .from('wallet_transactions')
      .insert({
        user_id: user.id,
        transaction_hash: `earnings_withdrawal_${Date.now()}`,
        transaction_type: 'earnings_withdrawal',
        token_type: 'USDC',
        amount: earnedBalance,
        from_address: 'earnings_pool',
        to_address: user.wallet_address,
        status: 'confirmed'
      });

    return NextResponse.json({
      success: true,
      withdrawnAmount: earnedBalance.toFixed(2),
      newEarnedBalance: "0.00", // Reset to 0 after withdrawal
      newUsdcBalance: newUsdcBalance.toFixed(2),
      message: `Successfully transferred ${earnedBalance.toFixed(2)} USDC to your wallet balance! Your earned balance has been reset.`
    });

  } catch (error) {
    console.error('Withdraw earnings API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}