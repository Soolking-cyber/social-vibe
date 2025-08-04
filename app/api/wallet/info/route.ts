import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { walletService } from '@/lib/wallet';

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
    
    // Get user with wallet info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, eth_balance, usdc_balance, last_balance_update')
      .or(`email.eq.${userIdentifier},name.eq.${userIdentifier}`)
      .single();

    if (userError || !user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    if (!user.wallet_address) {
      return NextResponse.json({ 
        error: 'Wallet not found for user' 
      }, { status: 404 });
    }

    // Get fresh on-chain balances
    const balances = await walletService.getBalances(user.wallet_address);

    // Update balances in database
    await supabase
      .from('users')
      .update({
        eth_balance: parseFloat(balances.eth),
        usdc_balance: parseFloat(balances.usdc),
        last_balance_update: new Date().toISOString()
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      wallet: {
        address: user.wallet_address,
        balances: {
          eth: balances.eth,
          usdc: balances.usdc
        },
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching wallet info:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch wallet info' 
    }, { status: 500 });
  }
}