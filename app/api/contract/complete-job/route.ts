import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { createJobsFactoryService } from '@/lib/contract';
import { walletService } from '@/lib/wallet';
import { jobValidator } from '@/lib/job-validation';

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

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ 
        error: 'Job ID is required' 
      }, { status: 400 });
    }

    // Get user wallet info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, wallet_private_key')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address || !user.wallet_private_key) {
      return NextResponse.json({ 
        error: 'Wallet not found or not properly configured' 
      }, { status: 404 });
    }

    try {
      // Initialize contract service
      const jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
      
      // CRITICAL: Validate job state from contract before proceeding
      console.log(`=== VALIDATING JOB ${jobId} FROM CONTRACT ===`);
      const job = await jobsFactoryService.getJob(jobId);
      
      // Check if job exists (creator address is not zero)
      if (job.creator === '0x0000000000000000000000000000000000000000') {
        return NextResponse.json({ 
          error: 'Job not found on contract' 
        }, { status: 404 });
      }

      // CRITICAL: Use job validator to check all completion requirements
      const validation = await jobValidator.canUserCompleteJob(jobId, user.wallet_address);
      
      if (!validation.canComplete) {
        console.log(`Job completion validation failed: ${validation.reason}`);
        return NextResponse.json({ 
          error: validation.reason || 'Cannot complete this job'
        }, { status: 400 });
      }

      console.log(`✅ Job validation passed for job ${jobId}`);
      
      // Log job details for verification
      console.log(`Job details:`, {
        id: jobId,
        creator: job.creator,
        isActive: job.isActive,
        maxActions: Number(job.maxActions),
        completedActions: Number(job.completedActions),
        remainingActions: Number(job.maxActions) - Number(job.completedActions),
        pricePerAction: jobsFactoryService.formatUSDC(job.pricePerAction)
      });

      // Decrypt private key and create signer
      const privateKey = walletService.decrypt(user.wallet_private_key);
      const wallet = walletService.createWalletFromPrivateKey(privateKey);
      
      // Connect service with signer
      jobsFactoryService.connectSigner(wallet);

      // Complete job on contract
      const completeJobTx = await jobsFactoryService.completeJob(jobId);
      const receipt = await completeJobTx.wait();

      // Get reward amount from event logs
      const jobCompletedEvent = receipt.logs.find((log: any) => 
        log.topics && log.topics.length > 2
      );

      let rewardAmount = '0';
      if (jobCompletedEvent) {
        try {
          const decoded = jobsFactoryService.contract.interface.parseLog(jobCompletedEvent);
          rewardAmount = jobsFactoryService.formatUSDC(decoded.args.reward);
        } catch (error) {
          console.error('Error parsing event log:', error);
          // Fallback: get reward from job details
          rewardAmount = jobsFactoryService.formatUSDC(job.pricePerAction);
        }
      } else {
        // Fallback: use job price per action
        rewardAmount = jobsFactoryService.formatUSDC(job.pricePerAction);
      }

      // Calculate current earned balance from job completions
      const { data: completions } = await supabase
        .from('job_completions')
        .select('reward_amount')
        .eq('user_id', user.id);

      const currentEarnedBalance = completions?.reduce((sum, completion) => {
        const amount = typeof completion.reward_amount === 'string'
          ? parseFloat(completion.reward_amount)
          : completion.reward_amount;
        return sum + amount;
      }, 0) || 0;

      const newEarnedBalance = currentEarnedBalance + parseFloat(rewardAmount);

      // Update last balance update timestamp
      await supabase
        .from('users')
        .update({ 
          last_balance_update: new Date().toISOString()
        })
        .eq('id', user.id);

      // Record completion in database
      await supabase
        .from('job_completions')
        .insert({
          job_id: jobId,
          user_id: user.id,
          reward_amount: parseFloat(rewardAmount),
          completed_at: new Date().toISOString()
        });

      // Record transaction
      await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user.id,
          transaction_hash: completeJobTx.hash,
          transaction_type: 'job_completion',
          token_type: 'USDC',
          amount: parseFloat(rewardAmount),
          from_address: process.env.JOBS_FACTORY_CONTRACT_ADDRESS!,
          to_address: user.wallet_address,
          status: 'confirmed'
        });

      return NextResponse.json({
        success: true,
        transactionHash: completeJobTx.hash,
        rewardAmount,
        newEarnedBalance: newEarnedBalance.toFixed(2),
        message: `Job completed successfully! Earned ${rewardAmount} USDC`,
        canWithdraw: newEarnedBalance >= 10
      });

    } catch (contractError) {
      console.error('Contract interaction failed:', contractError);
      return NextResponse.json({ 
        error: `Contract interaction failed: ${contractError instanceof Error ? contractError.message : 'Unknown error'}` 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Complete job API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}