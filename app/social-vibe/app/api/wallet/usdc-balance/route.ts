import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { authOptions } from '@/auth';
import { usdcService } from '@/lib/contract';

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
    
    if (!userIdentifier) {
      return NextResponse.json({ 
        error: 'Unable to identify user' 
      }, { status: 401 });
    }

    // Get user wallet info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('wallet_address, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address) {
      return NextResponse.json({ 
        error: 'Wallet not found' 
      }, { status: 404 });
    }

    try {
      // Get actual on-chain USDC balance
      const onChainBalance = await usdcService.getBalance(user.wallet_address);
      const onChainBalanceFormatted = parseFloat(ethers.formatUnits(onChainBalance, 6));
      const databaseBalance = parseFloat(user.usdc_balance?.toString() || '0');

      return NextResponse.json({
        wallet_address: user.wallet_address,
        database_balance: databaseBalance,
        onchain_balance: onChainBalanceFormatted,
        balance_match: Math.abs(databaseBalance - onChainBalanceFormatted) < 0.01,
        usdc_contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
      });

    } catch (contractError) {
      console.error('Error checking USDC balance:', contractError);
      return NextResponse.json({ 
        error: `Failed to check on-chain balance: ${contractError instanceof Error ? contractError.message : 'Unknown error'}` 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('USDC balance API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}