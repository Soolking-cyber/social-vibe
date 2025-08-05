import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { createClient } from '@supabase/supabase-js';

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

    const {
      jobId,
      verificationId,
      verificationResult,
      actionType,
      tweetUrl
    } = await request.json();

    console.log(`=== ACTION VERIFICATION REQUEST ===`);
    console.log(`User: ${session.user.email || session.user.name}`);
    console.log(`Job ID: ${jobId}`);
    console.log(`Verification ID: ${verificationId}`);
    console.log(`Action Type: ${actionType}`);
    console.log(`Tweet URL: ${tweetUrl}`);
    console.log(`Verification Result:`, verificationResult);

    // Validate verification result
    if (!verificationResult || typeof verificationResult !== 'object') {
      return NextResponse.json({
        error: 'Invalid verification result'
      }, { status: 400 });
    }

    const { success, confidence, method } = verificationResult;

    // Server-side verification logic
    let serverVerification = {
      passed: false,
      reason: 'Unknown',
      score: 0
    };

    // Check verification confidence and method
    if (success && confidence === 'high') {
      serverVerification = {
        passed: true,
        reason: 'High confidence automatic verification',
        score: 95
      };
    } else if (success && confidence === 'medium') {
      // Medium confidence requires additional checks
      if (method.includes('time_validated') || method.includes('multi_method')) {
        serverVerification = {
          passed: true,
          reason: 'Medium confidence with supporting evidence',
          score: 80
        };
      } else {
        serverVerification = {
          passed: true,
          reason: 'Medium confidence manual verification',
          score: 70
        };
      }
    } else if (success && confidence === 'low') {
      // Low confidence only passes for manual confirmations
      if (method.includes('manual')) {
        serverVerification = {
          passed: true,
          reason: 'Manual confirmation accepted',
          score: 60
        };
      } else {
        serverVerification = {
          passed: false,
          reason: 'Low confidence automatic verification rejected',
          score: 30
        };
      }
    } else {
      serverVerification = {
        passed: false,
        reason: 'Verification failed',
        score: 0
      };
    }

    // Additional server-side checks
    const userEmail = session.user.email || session.user.name || '';
    if (!userEmail) {
      return NextResponse.json({
        error: 'Unable to identify user'
      }, { status: 401 });
    }

    const additionalChecks = await performAdditionalVerificationChecks({
      jobId,
      actionType,
      tweetUrl,
      userEmail,
      verificationId
    });

    // Combine client and server verification
    const finalVerification = {
      success: serverVerification.passed && additionalChecks.passed,
      clientVerification: verificationResult,
      serverVerification,
      additionalChecks,
      finalScore: Math.min(serverVerification.score, additionalChecks.score),
      timestamp: new Date().toISOString()
    };

    console.log(`=== FINAL VERIFICATION RESULT ===`);
    console.log(`Success: ${finalVerification.success}`);
    console.log(`Final Score: ${finalVerification.finalScore}`);
    console.log(`Server Reason: ${serverVerification.reason}`);
    console.log(`Additional Checks: ${additionalChecks.reason}`);

    // Log verification attempt
    await logVerificationAttempt({
      jobId,
      userEmail,
      verificationId,
      actionType,
      tweetUrl,
      result: finalVerification
    });

    return NextResponse.json({
      success: finalVerification.success,
      verification: finalVerification,
      message: finalVerification.success
        ? 'Action verified successfully!'
        : `Verification failed: ${serverVerification.reason}`
    });

  } catch (error) {
    console.error('Verification API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

async function performAdditionalVerificationChecks({
  jobId,
  actionType,
  tweetUrl,
  userEmail,
  verificationId
}: {
  jobId: string;
  actionType: string;
  tweetUrl: string;
  userEmail: string;
  verificationId: string;
}) {
  try {
    // Check if user has already completed this job
    const { data: existingCompletion, error: completionError } = await supabase
      .from('job_completions')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_email', userEmail)
      .single();

    // If table doesn't exist, skip this check
    if (!completionError && existingCompletion) {
      return {
        passed: false,
        reason: 'User has already completed this job',
        score: 0
      };
    }

    // Check if this verification ID was already used
    const { data: existingVerification, error: verificationError } = await supabase
      .from('verification_logs')
      .select('*')
      .eq('verification_id', verificationId)
      .eq('success', true)
      .single();

    // If table doesn't exist, skip this check
    if (!verificationError && existingVerification) {
      return {
        passed: false,
        reason: 'Verification ID already used',
        score: 0
      };
    }

    // Check rate limiting (max 10 verifications per hour per user)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateLimitError } = await supabase
      .from('verification_logs')
      .select('*', { count: 'exact' })
      .eq('user_email', userEmail)
      .gte('created_at', oneHourAgo);

    // If table doesn't exist, skip rate limiting
    if (!rateLimitError && count && count >= 10) {
      return {
        passed: false,
        reason: 'Rate limit exceeded (max 10 verifications per hour)',
        score: 0
      };
    }

    // Check if tweet URL is valid format
    const tweetIdMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!tweetIdMatch) {
      return {
        passed: false,
        reason: 'Invalid tweet URL format',
        score: 0
      };
    }

    // All checks passed
    return {
      passed: true,
      reason: 'All additional checks passed',
      score: 100
    };

  } catch (error) {
    console.error('Additional verification checks error:', error);
    return {
      passed: false,
      reason: 'Error performing additional checks',
      score: 0
    };
  }
}

async function logVerificationAttempt({
  jobId,
  userEmail,
  verificationId,
  actionType,
  tweetUrl,
  result
}: {
  jobId: string;
  userEmail: string;
  verificationId: string;
  actionType: string;
  tweetUrl: string;
  result: any;
}) {
  try {
    const { error } = await supabase
      .from('verification_logs')
      .insert({
        job_id: jobId,
        user_email: userEmail,
        verification_id: verificationId,
        action_type: actionType,
        tweet_url: tweetUrl,
        success: result.success,
        client_result: result.clientVerification,
        server_result: result.serverVerification,
        additional_checks: result.additionalChecks,
        final_score: result.finalScore,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Verification logging failed (table may not exist):', error.message);
    }
  } catch (error) {
    console.error('Error logging verification attempt:', error);
  }
}