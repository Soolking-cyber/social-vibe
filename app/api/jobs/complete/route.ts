import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { jobValidator } from '@/lib/job-validation';


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

    const { jobId, phase = 'start' } = body;
    console.log(`Job completion request:`, { jobId, phase, type: typeof jobId, hasJobId: !!jobId });

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

      // Handle two-phase verification process
      if (phase === 'start') {
        console.log(`🚀 PHASE 1: Starting verification - capturing BEFORE counts`);
        
        // Get BEFORE counts (baseline)
        console.log(`📊 Getting BEFORE counts for tweet ${tweetId}...`);
        const beforeResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/twitterapi-io-proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getTweetCounts',
            tweetId: tweetId
          })
        });

        if (!beforeResponse.ok) {
          throw new Error('Failed to get before counts');
        }

        const beforeData = await beforeResponse.json();
        if (!beforeData.success) {
          throw new Error(beforeData.error || 'Failed to get before counts');
        }

        const beforeCounts = beforeData.counts;
        console.log(`✅ BEFORE counts captured:`, beforeCounts);

        // Store verification session in memory/database for later verification
        const verificationKey = `verification_${user.id}_${jobIdNumber}`;
        
        // Try to store in a simple table or use a cache mechanism
        // For now, we'll use a simple approach with user metadata or a separate table
        try {
          const { error: sessionError } = await supabase
            .from('verification_sessions')
            .upsert({
              user_id: user.id,
              job_id: jobIdNumber,
              tweet_id: tweetId,
              action_type: job.actionType,
              before_counts: beforeCounts,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
            }, {
              onConflict: 'user_id,job_id'
            });

          if (sessionError) {
            console.warn('Could not store verification session in database:', sessionError);
            // Continue anyway - we'll return the before counts to the client
          }
        } catch (dbError) {
          console.warn('Verification sessions table may not exist, continuing with client-side storage');
        }

        // Return the before counts and instructions for the user
        return NextResponse.json({
          phase: 'verification_ready',
          message: `Ready to verify your ${job.actionType} action. Please complete the action on Twitter, then click "Verify ${job.actionType.charAt(0).toUpperCase() + job.actionType.slice(1)}" to confirm.`,
          beforeCounts,
          tweetId,
          tweetUrl: job.tweetUrl,
          actionType: job.actionType,
          instructions: {
            like: 'Click the heart icon on the tweet to like it',
            retweet: 'Click the retweet icon and confirm the retweet',
            comment: 'Click reply and post your comment on the tweet'
          }[job.actionType] || 'Complete the required action on the tweet'
        });

      } else if (phase === 'verify') {
        console.log(`🔍 PHASE 2: Verifying action completion`);

        // Get before counts from the request or database
        let beforeCounts = body.beforeCounts;
        
        if (!beforeCounts) {
          // Try to get from database
          try {
            const { data: session } = await supabase
              .from('verification_sessions')
              .select('before_counts, created_at')
              .eq('user_id', user.id)
              .eq('job_id', jobIdNumber)
              .single();

            if (session) {
              beforeCounts = session.before_counts;
              console.log(`📋 Retrieved before counts from database:`, beforeCounts);
              
              // Check if session is expired (10 minutes)
              const sessionAge = Date.now() - new Date(session.created_at).getTime();
              if (sessionAge > 10 * 60 * 1000) {
                return NextResponse.json({
                  error: 'Verification session expired. Please start the process again.',
                  phase: 'expired'
                }, { status: 400 });
              }
            }
          } catch (dbError) {
            console.warn('Could not retrieve verification session from database');
          }
        }

        if (!beforeCounts) {
          return NextResponse.json({
            error: 'No verification session found. Please start the completion process first.',
            phase: 'restart_required'
          }, { status: 400 });
        }

        // Get AFTER counts
        console.log(`📊 Getting AFTER counts for tweet ${tweetId}...`);
        const afterResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/twitterapi-io-proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getTweetCounts',
            tweetId: tweetId
          })
        });

        if (!afterResponse.ok) {
          throw new Error('Failed to get after counts');
        }

        const afterData = await afterResponse.json();
        if (!afterData.success) {
          throw new Error(afterData.error || 'Failed to get after counts');
        }

        const afterCounts = afterData.counts;
        console.log(`✅ AFTER counts captured:`, afterCounts);

        // Verify the action by comparing counts
        console.log(`🔍 Verifying ${job.actionType} action by comparing counts...`);

        // Map action types to API verification actions
        let apiAction = '';
        if (job.actionType === 'like') apiAction = 'verifyLike';
        else if (job.actionType === 'retweet') apiAction = 'verifyRetweet';
        else if (job.actionType === 'comment') apiAction = 'verifyReply';

        if (!apiAction) {
          throw new Error(`Unsupported action type: ${job.actionType}`);
        }

        // Use the verification endpoint with before/after counts
        const verificationResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/twitterapi-io-proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: apiAction,
            tweetId: tweetId,
            beforeCounts: beforeCounts,
            afterCounts: afterCounts
          })
        });

        if (!verificationResponse.ok) {
          throw new Error('Failed to verify action');
        }

        const verificationResult = await verificationResponse.json();
        console.log(`📋 Verification result:`, verificationResult);

        if (!verificationResult.success || !verificationResult.verified) {
          console.log(`❌ Action verification failed:`, verificationResult.message);

          // Provide detailed feedback about what went wrong
          const countType = job.actionType === 'like' ? 'likes' :
            job.actionType === 'retweet' ? 'retweets' : 'replies';
          const beforeCount = beforeCounts[countType] || 0;
          const afterCount = afterCounts[countType] || 0;

          return NextResponse.json({
            error: `Could not verify your ${job.actionType} action. The ${countType} count did not increase.`,
            phase: 'verification_failed',
            details: {
              expected: `${countType} count should increase from ${beforeCount}`,
              actual: `${countType} count remained at ${afterCount}`,
              message: 'Please ensure you completed the action on Twitter and try again.',
              beforeCounts,
              afterCounts
            }
          }, { status: 400 });
        }

        console.log(`✅ Action verification successful:`, verificationResult.message);
        console.log(`📈 Count increase detected:`, {
          action: job.actionType,
          difference: verificationResult.counts?.difference || 0,
          confidence: verificationResult.confidence || 'unknown',
          beforeCounts: verificationResult.counts?.before,
          afterCounts: verificationResult.counts?.after
        });

        // Log the successful verification for audit purposes
        console.log(`🎯 VERIFICATION SUMMARY:`, {
          userId: user.id,
          jobId: jobIdNumber,
          tweetId: tweetId,
          actionType: job.actionType,
          verificationMethod: 'two_phase_before_after_comparison',
          countIncrease: verificationResult.counts?.difference || 0,
          confidence: verificationResult.confidence,
          timestamp: new Date().toISOString()
        });

        // Clean up verification session
        try {
          await supabase
            .from('verification_sessions')
            .delete()
            .eq('user_id', user.id)
            .eq('job_id', jobIdNumber);
        } catch (cleanupError) {
          console.warn('Could not clean up verification session:', cleanupError);
        }

        // Verification completed successfully - proceed with reward
        console.log(`🎉 Proceeding with job completion and reward...`);

      } else {
        return NextResponse.json({
          error: 'Invalid phase. Use "start" to begin verification or "verify" to complete it.',
          validPhases: ['start', 'verify']
        }, { status: 400 });
      }

    } catch (verificationError) {
      console.error('Twitter verification process failed:', verificationError);
      return NextResponse.json({
        error: 'Verification service temporarily unavailable. Please try again later.',
        details: verificationError instanceof Error ? verificationError.message : 'Unknown error'
      }, { status: 500 });
    }

    // Only proceed with reward if we're in the verify phase and verification passed
    if (phase !== 'verify') {
      return NextResponse.json({
        error: 'Reward processing only available in verify phase'
      }, { status: 400 });
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