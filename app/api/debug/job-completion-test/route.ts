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
        const { jobId } = await request.json();

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userIdentifier = session.user.email || session.user.name;
        const jobIdNumber = parseInt(jobId);

        const tests = {
            session_check: {
                success: !!session?.user,
                user_name: session?.user?.name,
                user_email: session?.user?.email,
                user_identifier: userIdentifier
            },
            user_lookup: null as any,
            job_lookup: null as any,
            validation_check: null as any,
            existing_completion_check: null as any
        };

        // Test 1: User lookup
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, wallet_address, name, twitter_handle')
                .eq('name', userIdentifier)
                .single();

            tests.user_lookup = {
                success: !userError && !!user,
                user_found: !!user,
                user_id: user?.id,
                wallet_address: user?.wallet_address,
                twitter_handle: user?.twitter_handle,
                error: userError?.message
            };
        } catch (error) {
            tests.user_lookup = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }

        // Test 2: Job lookup
        if (tests.user_lookup.success) {
            try {
                const job = await jobValidator.getJobFromContract(jobIdNumber);
                tests.job_lookup = {
                    success: !!job,
                    job_found: !!job,
                    job_id: jobIdNumber,
                    action_type: job?.actionType,
                    tweet_url: job?.tweetUrl,
                    price_per_action: job?.pricePerAction,
                    creator: job?.creator
                };
            } catch (error) {
                tests.job_lookup = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }

        // Test 3: Validation check
        if (tests.user_lookup.success && tests.job_lookup.success) {
            try {
                const validation = await jobValidator.canUserCompleteJob(jobIdNumber, tests.user_lookup.wallet_address);
                tests.validation_check = {
                    success: validation.canComplete,
                    can_complete: validation.canComplete,
                    reason: validation.reason
                };
            } catch (error) {
                tests.validation_check = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }

        // Test 4: Existing completion check
        if (tests.user_lookup.success) {
            try {
                const { data: existingCompletion } = await supabase
                    .from('job_completions')
                    .select('id')
                    .eq('job_id', jobIdNumber)
                    .eq('user_id', tests.user_lookup.user_id)
                    .single();

                tests.existing_completion_check = {
                    success: true,
                    has_completed: !!existingCompletion,
                    completion_id: existingCompletion?.id
                };
            } catch (error) {
                tests.existing_completion_check = {
                    success: true, // This is expected to fail if no completion exists
                    has_completed: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }

        return NextResponse.json({
            success: true,
            job_id: jobIdNumber,
            tests,
            overall_status: {
                can_proceed: tests.user_lookup?.success &&
                    tests.job_lookup?.success &&
                    tests.validation_check?.success &&
                    !tests.existing_completion_check?.has_completed,
                blocking_issues: [
                    !tests.user_lookup?.success && 'User not found',
                    !tests.job_lookup?.success && 'Job not found',
                    !tests.validation_check?.success && `Validation failed: ${tests.validation_check?.reason}`,
                    tests.existing_completion_check?.has_completed && 'Already completed'
                ].filter(Boolean)
            }
        });

    } catch (error) {
        console.error('Error in job completion test:', error);
        return NextResponse.json({
            error: 'Test failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}