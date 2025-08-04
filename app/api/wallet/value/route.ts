import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { walletService } from '@/lib/wallet';
import { priceService } from '@/lib/price';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
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

    // Check if fresh balances are requested
    const url = new URL(request.url);
    const fetchFresh = url.searchParams.get('fresh') === 'true';

    // Get user with wallet info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, eth_balance, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address) {
      return NextResponse.json({
        error: 'Wallet not found'
      }, { status: 404 });
    }

    let balances = {
      eth: user.eth_balance?.toString() || '0.0',
      usdc: user.usdc_balance?.toString() || '0.0'
    };

    // Fetch fresh balances if requested
    if (fetchFresh) {
      try {
        const freshBalances = await walletService.getBalances(user.wallet_address);
        balances = {
          eth: freshBalances.eth,
          usdc: freshBalances.usdc
        };

        // Update cached balances in database
        await supabase
          .from('users')
          .update({
            eth_balance: parseFloat(freshBalances.eth),
            usdc_balance: parseFloat(freshBalances.usdc),
            last_balance_update: new Date().toISOString()
          })
          .eq('id', user.id);
      } catch (balanceError) {
        console.error('Error fetching fresh balances:', balanceError);
        // Fall back to cached balances if blockchain fetch fails
      }
    }

    // Calculate USD values from cached balances
    const walletValue = await priceService.calculateWalletValue(
      balances.eth,
      balances.usdc
    );

    return NextResponse.json({
      success: true,
      balances: {
        eth: balances.eth,
        usdc: balances.usdc
      },
      usdValues: {
        ethValueUsd: walletValue.ethValueUsd,
        usdcValueUsd: walletValue.usdcValueUsd,
        totalValueUsd: walletValue.totalValueUsd,
        formattedTotal: priceService.formatUsd(walletValue.totalValueUsd)
      },
      ethPrice: await priceService.getEthPrice()
    });
  } catch (error) {
    console.error('Error fetching wallet value:', error);
    return NextResponse.json({
      error: 'Failed to fetch wallet value'
    }, { status: 500 });
  }
}