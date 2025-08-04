import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { walletService } from '@/lib/wallet';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, eth_balance, usdc_balance, last_balance_update')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address) {
      return NextResponse.json({
        error: 'Wallet not found'
      }, { status: 404 });
    }

    console.log(`=== ETH BALANCE DEBUG FOR ${userIdentifier} ===`);
    console.log(`Wallet address: ${user.wallet_address}`);
    console.log(`Cached ETH balance: ${user.eth_balance}`);
    console.log(`Last balance update: ${user.last_balance_update}`);

    // Get fresh balance from blockchain
    let freshBalance = null;
    let balanceError = null;
    
    try {
      console.log('Fetching fresh balance from blockchain...');
      const balances = await walletService.getBalances(user.wallet_address);
      freshBalance = balances;
      console.log(`Fresh ETH balance: ${balances.eth} ETH`);
      console.log(`Fresh USDC balance: ${balances.usdc} USDC`);
    } catch (error) {
      console.error('Error fetching fresh balance:', error);
      balanceError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Calculate earned balance
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

    return NextResponse.json({
      success: true,
      debug: {
        walletAddress: user.wallet_address,
        cachedBalances: {
          eth: user.eth_balance,
          usdc: user.usdc_balance,
          lastUpdate: user.last_balance_update
        },
        freshBalances: freshBalance,
        balanceError: balanceError,
        earnedBalance: earnedBalance,
        canWithdraw: earnedBalance >= 10,
        ethSufficient: freshBalance ? parseFloat(freshBalance.eth) >= 0.00005 : null,
        minEthRequired: 0.00005,
        recommendations: {
          needsEth: freshBalance ? parseFloat(freshBalance.eth) < 0.00005 : null,
          needsMoreEarnings: earnedBalance < 10,
          readyToWithdraw: earnedBalance >= 10 && freshBalance && parseFloat(freshBalance.eth) >= 0.00005
        }
      }
    });

  } catch (error) {
    console.error('ETH balance debug error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}