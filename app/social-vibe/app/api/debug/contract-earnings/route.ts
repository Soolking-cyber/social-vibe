import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { createJobsFactoryService } from '@/lib/contract';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userIdentifier = session.user.email || session.user.name;
        
        // Get user wallet info
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, wallet_address, name')
            .eq('name', userIdentifier)
            .single();

        if (userError || !user?.wallet_address) {
            return NextResponse.json({ error: 'User or wallet not found' }, { status: 404 });
        }

        // Get database job completions
        const { data: completions } = await supabase
            .from('job_completions')
            .select('job_id, reward_amount, completed_at')
            .eq('user_id', user.id);

        const dbEarnedBalance = completions?.reduce((sum, completion) => {
            const amount = typeof completion.reward_amount === 'string'
                ? parseFloat(completion.reward_amount)
                : completion.reward_amount;
            return sum + amount;
        }, 0) || 0;

        // Get contract earnings
        const jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
        const contractEarnings = await jobsFactoryService.getUserEarnings(user.wallet_address);
        
        const totalEarned = parseFloat(
            jobsFactoryService.formatUSDC(contractEarnings.totalEarned)
        );
        const availableForWithdrawal = parseFloat(
            jobsFactoryService.formatUSDC(contractEarnings.availableForWithdrawal)
        );
        const totalWithdrawn = parseFloat(
            jobsFactoryService.formatUSDC(contractEarnings.totalWithdrawn)
        );

        return NextResponse.json({
            success: true,
            user: {
                name: user.name,
                wallet_address: user.wallet_address
            },
            database_earnings: {
                job_completions_count: completions?.length || 0,
                earned_balance: dbEarnedBalance,
                completions: completions || []
            },
            contract_earnings: {
                total_earned: totalEarned,
                available_for_withdrawal: availableForWithdrawal,
                total_withdrawn: totalWithdrawn,
                raw_contract_data: {
                    totalEarned: contractEarnings.totalEarned.toString(),
                    availableForWithdrawal: contractEarnings.availableForWithdrawal.toString(),
                    totalWithdrawn: contractEarnings.totalWithdrawn.toString()
                }
            },
            comparison: {
                db_vs_contract_earned: dbEarnedBalance - totalEarned,
                can_withdraw_from_contract: availableForWithdrawal >= 10,
                can_withdraw_from_db: dbEarnedBalance >= 10
            }
        });

    } catch (error) {
        console.error('Error checking contract earnings:', error);
        return NextResponse.json({
            error: 'Failed to check contract earnings',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}