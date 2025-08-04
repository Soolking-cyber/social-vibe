import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface User {
    id: string;
    balance: number;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        console.log('Deposit API - Session:', session); // Debug log
        
        // Type guard to ensure session and user exist
        if (!session?.user?.email) {
            console.log('Deposit API - No session or email found'); // Debug log
            return NextResponse.json({ error: 'Unauthorized - No session found' }, { status: 401 });
        }

        const { amount } = await request.json();

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        // Get or create user in database
        let { data: user, error: userError } = await supabase
            .from('users')
            .select('id, balance')
            .eq('email', session.user.email)
            .single();

        // If user doesn't exist, create them
        if (userError && userError.code === 'PGRST116') {
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    email: session.user.email,
                    name: session.user.name || null,
                    image: session.user.image || null,
                    balance: 10.00 // Give new users $10 to start
                })
                .select('id, balance')
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

        // Update user balance
        const currentBalance = typeof user.balance === 'string' ? parseFloat(user.balance) : user.balance;
        const depositAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        const newBalance = currentBalance + depositAmount;
        
        const { error: balanceError } = await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', user.id);

        if (balanceError) throw balanceError;

        // Record transaction
        await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                type: 'deposit',
                amount: depositAmount,
                description: `Deposit of $${depositAmount.toFixed(2)}`
            });

        return NextResponse.json({
            success: true,
            newBalance,
            message: `Successfully deposited $${depositAmount.toFixed(2)}`
        });
    } catch (error) {
        console.error('Error processing deposit:', error);
        return NextResponse.json({ error: 'Failed to process deposit' }, { status: 500 });
    }
}