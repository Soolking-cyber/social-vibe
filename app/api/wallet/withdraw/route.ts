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

        const { token, amount, toAddress } = await request.json();

        // Validate input
        if (!token || !amount || !toAddress) {
            return NextResponse.json({
                error: 'Missing required fields: token, amount, toAddress'
            }, { status: 400 });
        }

        if (!['ETH', 'USDC'].includes(token)) {
            return NextResponse.json({
                error: 'Invalid token. Must be ETH or USDC'
            }, { status: 400 });
        }

        const withdrawAmount = parseFloat(amount);
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return NextResponse.json({
                error: 'Invalid amount'
            }, { status: 400 });
        }

        // Validate Ethereum address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
            return NextResponse.json({
                error: 'Invalid Ethereum address format'
            }, { status: 400 });
        }

        console.log('Processing withdrawal:', { token, amount: withdrawAmount, toAddress, user: userIdentifier });

        // Get user with wallet info
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, wallet_address, wallet_private_key, eth_balance, usdc_balance')
            .eq('name', userIdentifier)
            .single();

        if (userError || !user || !user.wallet_address || !user.wallet_private_key) {
            return NextResponse.json({
                error: 'Wallet not found or not properly configured'
            }, { status: 404 });
        }

        // Check balance
        const currentBalance = token === 'ETH'
            ? parseFloat(user.eth_balance?.toString() || '0')
            : parseFloat(user.usdc_balance?.toString() || '0');

        if (currentBalance < withdrawAmount) {
            return NextResponse.json({
                error: `Insufficient ${token} balance. Available: ${currentBalance.toFixed(token === 'ETH' ? 4 : 2)}, Requested: ${withdrawAmount.toFixed(token === 'ETH' ? 4 : 2)}`
            }, { status: 400 });
        }

        // Decrypt private key
        const privateKey = walletService.decrypt(user.wallet_private_key);

        let transactionHash: string;

        try {
            // Send transaction
            if (token === 'ETH') {
                transactionHash = await walletService.sendEth(privateKey, toAddress, amount);
            } else {
                transactionHash = await walletService.sendUsdc(privateKey, toAddress, amount);
            }

            console.log('Transaction sent:', transactionHash);

            // Record transaction in database
            await supabase
                .from('wallet_transactions')
                .insert({
                    user_id: user.id,
                    transaction_hash: transactionHash,
                    transaction_type: 'withdrawal',
                    token_type: token,
                    amount: withdrawAmount,
                    from_address: user.wallet_address,
                    to_address: toAddress,
                    status: 'pending'
                });

            // Update user balance (optimistic update)
            const newBalance = currentBalance - withdrawAmount;
            const updateField = token === 'ETH' ? 'eth_balance' : 'usdc_balance';

            await supabase
                .from('users')
                .update({
                    [updateField]: newBalance,
                    last_balance_update: new Date().toISOString()
                })
                .eq('id', user.id);

            return NextResponse.json({
                success: true,
                transactionHash,
                message: `Successfully sent ${withdrawAmount} ${token} to ${toAddress}`,
                newBalance: newBalance.toFixed(token === 'ETH' ? 4 : 2)
            });

        } catch (transactionError) {
            console.error('Transaction failed:', transactionError);

            // Record failed transaction
            await supabase
                .from('wallet_transactions')
                .insert({
                    user_id: user.id,
                    transaction_hash: 'failed',
                    transaction_type: 'withdrawal',
                    token_type: token,
                    amount: withdrawAmount,
                    from_address: user.wallet_address,
                    to_address: toAddress,
                    status: 'failed'
                });

            return NextResponse.json({
                error: `Transaction failed: ${transactionError instanceof Error ? transactionError.message : 'Unknown error'}`
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Withdrawal API error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}