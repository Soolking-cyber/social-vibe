import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { walletService } from '@/lib/wallet';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
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

    console.log('Refreshing wallet balances for user:', userIdentifier);

    // Get user with wallet info
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

    // Fetch fresh on-chain balances
    console.log('Fetching fresh balances from blockchain...');
    const balances = await walletService.getBalances(user.wallet_address);

    // Calculate USD values (simplified)
    const ethAmount = parseFloat(balances.eth) || 0;
    const usdcAmount = parseFloat(balances.usdc) || 0;
    
    // Use a simple fallback ETH price
    const ethPrice = 2000; // Fallback price
    const ethValueUsd = ethAmount * ethPrice;
    const usdcValueUsd = usdcAmount; // USDC is 1:1 with USD
    const totalValueUsd = ethValueUsd + usdcValueUsd;
    
    const walletValue = {
      ethValueUsd,
      usdcValueUsd,
      totalValueUsd
    };

    // Update balances in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        eth_balance: parseFloat(balances.eth),
        usdc_balance: parseFloat(balances.usdc),
        last_balance_update: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating balances:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update balances' 
      }, { status: 500 });
    }

    console.log('Balances refreshed successfully:', {
      eth: balances.eth,
      usdc: balances.usdc,
      totalUsd: walletValue.totalValueUsd
    });

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
        formattedTotal: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(walletValue.totalValueUsd)
      },
      ethPrice: 2000, // Fallback price
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing wallet balances:', error);
    return NextResponse.json({ 
      error: 'Failed to refresh wallet balances' 
    }, { status: 500 });
  }
}