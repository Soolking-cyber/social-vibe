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
    
    // Get user with encrypted private key
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_private_key, wallet_mnemonic')
      .or(`email.eq.${userIdentifier},name.eq.${userIdentifier}`)
      .single();

    if (userError || !user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    if (!user.wallet_private_key) {
      return NextResponse.json({ 
        error: 'Wallet not found for user' 
      }, { status: 404 });
    }

    // Decrypt private key and mnemonic
    const privateKey = walletService.decrypt(user.wallet_private_key);
    const mnemonic = walletService.decrypt(user.wallet_mnemonic);

    return NextResponse.json({
      success: true,
      privateKey,
      mnemonic
    });
  } catch (error) {
    console.error('Error fetching private key:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch private key' 
    }, { status: 500 });
  }
}