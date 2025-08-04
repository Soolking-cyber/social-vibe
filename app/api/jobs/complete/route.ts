import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { jobValidator } from '@/lib/job-validation';
import { twitterVerificationService } from '@/lib/twitter-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log(`=== JOB COMPLETION REQUEST ===`);
    console.log(`Request body:`, body);
    
    const { jobId } = body;

    if (!jobId) {
      console.log(`❌ No jobId provided in request`);
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`User: ${session.user.name}`);
    console.log(`Job ID: ${jobId} (type: ${typeof jobId})`);

    const userIdentifier = session.user.email || session.user.name;

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, name, twitter_handle')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user) {
      console.log(`❌ User not found:`, { userIdentifier, userError });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`✅ User found:`, { 
      id: user.id, 
      name: user.name, 
      twitter_handle: user.twitter_handle,
      wallet_address: user.wallet_address 
    });

    // Get job details from contract
    const jobIdNumber = parseInt(jobId);
    console.log(`🔍 Looking up job ${jobIdNumber} from contract...`);
    
    const job = await jobValidator.getJobFromContract(jobIdNumber);
    if (!job) {
      console.log(`❌ Job ${jobIdNumber} not found in contract`);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log(`✅ Job found:`, {
      id: jobIdNumber,
      actionType: job.actionType,
      tweetUrl: job.tweetUrl,
      pricePerAction: job.pricePerAction,
      creator: job.creator
    });

    // Check if user can complete this job
    console.log(`🔍 Checking if user can complete job...`);
    const validation = await jobValidator.canUserCompleteJob(jobIdNumber, user.wallet_address);
    console.log(`Validation result:`, validation);
    
    if (!validation.canComplete) {
      console.log(`❌ User cannot complete job: ${validation.reason}`);
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    // Check if user has already completed this job in our database
    console.log(`🔍 Checking for existing completion...`);
    console.log(`Looking for: job_id=${jobIdNumber}, user_id=${user.id}`);
    
    const { data: existingCompletion, error: checkError } = await supabase
      .from('job_completions')
      .select('id, completed_at, reward_amount')
      .eq('job_id', jobIdNumber)
      .eq('user_id', user.id)
      .single();

    console.log(`Existing completion check result:`, { existingCompletion, checkError });

    if (existingCompletion) {
      console.log(`❌ User has already completed this job at ${existingCompletion.completed_at}`);
      return NextResponse.json({ 
        error: 'You have already completed this job',
        completedAt: existingCompletion.completed_at,
        previousReward: existingCompletion.reward_amount
      }, { status: 400 });
    }

    console.log(`✅ No existing completion found - user can complete this job`);

    // Verify Twitter action completion
    console.log(`=== VERIFYING TWITTER ACTION ===`);
    console.log(`Action type: ${job.actionType}`);
    console.log(`Tweet URL: ${job.tweetUrl}`);
    console.log(`User display name: ${user.name}`);
    console.log(`User Twitter handle: ${user.twitter_handle}`);

    // Check for development bypass first
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_TWITTER_VERIFICATION === 'true') {
      console.log('⚠️ DEVELOPMENT MODE: Bypassing Twitter verification entirely');
    } else {
      try {
        // Use Twitter handle if available, otherwise fall back to display name
        const twitterUsername = user.twitter_handle || user.name;
        
        if (!twitterUsername) {
          return NextResponse.json({
            error: 'No Twitter username found. Please ensure your account is properly linked.'
          }, { status: 400 });
        }

        // Clean the username - remove @ symbol and any extra characters
        const cleanUsername = twitterUsername.replace('@', '').replace(/[^a-zA-Z0-9_]/g, '');
        console.log(`Using Twitter username: ${cleanUsername}`);

        // Get user's Twitter ID from their username
        let userTwitterId: string | null = null;
        try {
          userTwitterId = await twitterVerificationService.getUserIdByUsername(cleanUsername);
          console.log(`Twitter ID lookup result: ${userTwitterId}`);
        } catch (twitterError) {
          console.error(`❌ Twitter username lookup failed:`, twitterError);
          
          const errorMessage = twitterError instanceof Error ? twitterError.message : 'Unknown Twitter API error';
          
          return NextResponse.json({
            error: `Twitter verification failed: ${errorMessage}\n\nPossible solutions:\n• Check that your Twitter username "${cleanUsername}" is correct\n• Ensure your Twitter account is public and active\n• Try again in a few minutes (API rate limits)\n• Contact support if the issue persists`
          }, { status: 400 });
        }

        if (!userTwitterId) {
          return NextResponse.json({
            error: `Could not find Twitter account for username "${cleanUsername}". This could mean:\n\n• The username is incorrect or misspelled\n• The account is private or suspended\n• The account doesn't exist\n\nPlease:\n1. Check your Twitter username in your profile\n2. Use the "Test Twitter Username" tool in the dashboard\n3. Update your Twitter handle if needed`
          }, { status: 400 });
        }

        console.log(`✅ Twitter ID found: ${userTwitterId}`);

        // Verify the action was completed
        console.log(`🔍 Starting verification process...`);
        console.log(`Tweet URL: ${job.tweetUrl}`);
        console.log(`Action Type: ${job.actionType}`);
        console.log(`User Twitter ID: ${userTwitterId}`);
        
        const isVerified = await twitterVerificationService.verifyJobCompletion(
          job.tweetUrl,
          userTwitterId,
          job.actionType,
          job.commentText
        );

        console.log(`Verification result: ${isVerified}`);

        if (!isVerified) {
          return NextResponse.json({
            error: `Could not verify that you completed the ${job.actionType} action. This could mean:\n\n• You haven't completed the action yet\n• The action was completed but not detected by Twitter's API\n• There's a delay in Twitter's data\n\nPlease:\n1. Make sure you completed the ${job.actionType} action\n2. Wait a few minutes and try again\n3. Check that the tweet still exists and is public`
          }, { status: 400 });
        }

        console.log(`✅ Twitter action verified successfully`);

      } catch (verificationError) {
        console.error('Twitter verification failed:', verificationError);
        return NextResponse.json({
          error: `Verification failed: ${verificationError instanceof Error ? verificationError.message : 'Unknown error'}. Please ensure you completed the action and your Twitter account is public.`
        }, { status: 500 });
      }
    }

    // Calculate reward amount
    const rewardAmount = parseFloat(job.pricePerAction);
    console.log(`💰 User will earn: ${rewardAmount} USDC for completing this job`);

    // Record job completion - this is critical to prevent duplicate completions
    console.log(`📝 Recording job completion...`);
    console.log(`Inserting: job_id=${jobIdNumber}, user_id=${user.id}, reward_amount=${rewardAmount}`);
    
    const { data: completionRecord, error: completionError } = await supabase
      .from('job_completions')
      .insert({
        job_id: jobIdNumber,
        user_id: user.id,
        reward_amount: rewardAmount,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    console.log(`Insert result:`, { completionRecord, completionError });

    if (completionError) {
      console.error('Failed to record job completion:', completionError);
      
      // Completion record is critical to prevent duplicate rewards
      console.log(`⚠️ Job completion record failed - this prevents duplicate completions`);
        
      return NextResponse.json({ 
        error: 'Failed to record job completion. Please try again.' 
      }, { status: 500 });
    }

    console.log(`✅ Job completion recorded:`, completionRecord);

    // Calculate new earned balance from all completions (including this one)
    const { data: allCompletions, error: completionsError } = await supabase
      .from('job_completions')
      .select('reward_amount')
      .eq('user_id', user.id);

    const newEarnedBalance = (allCompletions?.reduce((sum, completion) => {
      const amount = typeof completion.reward_amount === 'string'
        ? parseFloat(completion.reward_amount)
        : completion.reward_amount;
      return sum + amount;
    }, 0) || 0);

    const canWithdraw = newEarnedBalance >= 10;
    const message = canWithdraw
      ? `Great! You now have ${newEarnedBalance.toFixed(2)} USDC and can withdraw to your wallet.`
      : `You earned ${rewardAmount} USDC! Earn ${(10 - newEarnedBalance).toFixed(2)} more to unlock withdrawal.`;

    return NextResponse.json({
      success: true,
      rewardAmount: rewardAmount.toFixed(2),
      newEarnedBalance: newEarnedBalance.toFixed(2),
      canWithdraw,
      withdrawalThreshold: 10.0,
      message
    });

  } catch (error) {
    console.error('Error completing job:', error);
    return NextResponse.json({ error: 'Failed to complete job' }, { status: 500 });
  }
}