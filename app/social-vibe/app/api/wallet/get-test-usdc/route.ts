import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
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
      .select('id, wallet_address, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address) {
      return NextResponse.json({ 
        error: 'Wallet not found' 
      }, { status: 404 });
    }

    // For now, we'll simulate adding test USDC to the database
    // In a real implementation, you'd mint actual test USDC tokens
    const testAmount = 100; // Give 100 test USDC
    const currentBalance = parseFloat(user.usdc_balance?.toString() || '0');
    const newBalance = currentBalance + testAmount;

    // Update database balance
    await supabase
      .from('users')
      .update({
        usdc_balance: newBalance,
        last_balance_update: new Date().toISOString()
      })
      .eq('id', user.id);

    // NOTE: We don't record test faucet transactions in wallet_transactions
    // because they are not real on-chain transactions with valid transaction hashes
    console.log(`Test USDC faucet: Added ${testAmount} USDC to user ${user.id} (${user.wallet_address})`);

    return NextResponse.json({
      success: true,
      message: `Added ${testAmount} test USDC to your account`,
      previous_balance: currentBalance.toFixed(2),
      new_balance: newBalance.toFixed(2),
      note: 'This is test USDC for development. For real USDC, you need to deposit actual tokens to your wallet address.',
      wallet_address: user.wallet_address,
      usdc_contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
    });

  } catch (error) {
    console.error('Test USDC faucet error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}