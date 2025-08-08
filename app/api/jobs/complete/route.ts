import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { jobValidator } from '@/lib/job-validation';
import { twitterAPIIOVerifier } from '@/lib/twitterapi-io-verification';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log(`=== JOB COMPLETION REQUEST START ===`);
    console.log(`Request method: ${request.method}`);
    console.log(`Request URL: ${request.url}`);

    const session = await getServerSession(authOptions);
    console.log(`Session check result:`, {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      userName: session?.user?.name
    });

    if (!session?.user) {
      console.log(`❌ RETURNING 401: No session or user`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
      console.log(`✅ Request body parsed successfully:`, body);
    } catch (parseError) {
      console.log(`❌ RETURNING 400: Failed to parse request body:`, parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { jobId } = body;
    console.log(`Job ID extraction:`, { jobId, type: typeof jobId, hasJobId: !!jobId });

    if (!jobId) {
      console.log(`❌ RETURNING 400: No jobId provided in request`);
      console.log(`Full request body:`, JSON.stringify(body, null, 2));
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

    // Verify Twitter action completion using TwitterAPI.io
    console.log(`=== VERIFYING TWITTER ACTION WITH TWITTERAPI.IO ===`);
    console.log(`Action type: ${job.actionType}`);
    console.log(`Tweet URL: ${job.tweetUrl}`);
    console.log(`User display name: ${user.name}`);
    console.log(`User Twitter handle: ${user.twitter_handle}`);

    // Use TwitterAPI.io for real verification
    console.log('🚀 PRODUCTION MODE: Using TwitterAPI.io for reliable verification');

    try {
      // Use securely stored Twitter handle from database
      const twitterUsername = user.twitter_handle;

      if (!twitterUsername) {
        return NextResponse.json({
          error: 'No Twitter handle found in your profile. Please ensure your Twitter account is properly linked during login.'
        }, { status: 400 });
      }

      console.log(`✅ Using securely stored Twitter handle: ${twitterUsername}`);

      // Extract tweet ID for direct verification
      const tweetId = job.tweetUrl.match(/status\/(\d+)/)?.[1];
      if (!tweetId) {
        return NextResponse.json({
          error: 'Invalid tweet URL format'
        }, { status: 400 });
      }

      console.log(`✅ Extracted tweet ID: ${tweetId}`);

      // Perform dual verification using TwitterAPI.io
      console.log(`🔍 Starting TwitterAPI.io verification...`);
      
      let verificationPassed = false;
      let verificationMethod = '';

      // Method 1: Try count-based verification first
      try {
        console.log(`🔍 Attempting count-based verification...`);
        
        // For server-side verification, we need to create a temporary verification session
        const normalizedActionType = job.actionType === 'comment' ? 'reply' : job.actionType;
        const verificationId = await twitterAPIIOVerifier.startVerification(
          job.tweetUrl, 
          twitterUsername, 
          normalizedActionType as 'like' | 'retweet' | 'reply'
        );

        // Wait a moment for the initial counts to be captured
        await new Promise(resolve => setTimeout(resolve, 2000));

        const countResult = await twitterAPIIOVerifier.verifyCompletion(verificationId);
        
        if (countResult.success) {
          verificationPassed = true;
          verificationMethod = 'count_increase';
          console.log(`✅ Count-based verification succeeded: ${countResult.details}`);
        }
      } catch (countError) {
        console.log(`⚠️ Count-based verification failed:`, countError);
      }

      // Method 2: If count-based fails, try direct interaction verification
      if (!verificationPassed) {
        console.log(`🔍 Attempting direct interaction verification...`);
        
        try {
          // Map action types to API actions
          let apiAction = '';
          if (job.actionType === 'like') apiAction = 'verifyLike';
          else if (job.actionType === 'retweet') apiAction = 'verifyRetweet';
          else if (job.actionType === 'comment') apiAction = 'verifyReply';
          
          if (apiAction) {
            // Make direct API call to our proxy
            const directVerificationResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/twitterapi-io-proxy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: twitterUsername,
                action: apiAction,
                tweetId: tweetId
              })
            });

            if (directVerificationResponse.ok) {
              const directResult = await directVerificationResponse.json();
              
              if (directResult.success && directResult.verified) {
                verificationPassed = true;
                verificationMethod = 'direct_interaction';
                console.log(`✅ Direct interaction verification succeeded: ${directResult.message}`);
              }
            }
          }
        } catch (directError) {
          console.log(`⚠️ Direct interaction verification failed:`, directError);
        }
      }

      // Final verification check
      if (!verificationPassed) {
        console.log(`❌ All verification methods failed`);
        return NextResponse.json({
          error: `Could not verify your ${job.actionType} action. Please ensure you completed the action on Twitter and try again.`,
          details: 'TwitterAPI.io verification failed for both count increase and direct interaction methods.'
        }, { status: 400 });
      }

      console.log(`✅ Twitter action verification completed via ${verificationMethod}`);

    } catch (verificationError) {
      console.error('Twitter verification process failed:', verificationError);
      return NextResponse.json({
        error: 'Verification service temporarily unavailable. Please try again later.',
        details: verificationError instanceof Error ? verificationError.message : 'Unknown error'
      }, { status: 500 });
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
    const { data: allCompletions } = await supabase
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
    console.error('❌ CRITICAL ERROR in job completion:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json({
      error: 'Failed to complete job',
      debug: process.env.NODE_ENV === 'development' ? {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      } : undefined
    }, { status: 500 });
  }
}