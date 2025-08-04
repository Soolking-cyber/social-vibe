import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { jobValidator } from '@/lib/job-validation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const resolvedParams = await params;
    const jobId = parseInt(resolvedParams.id);
    
    if (isNaN(jobId)) {
      return NextResponse.json({
        error: 'Invalid job ID'
      }, { status: 400 });
    }

    const userIdentifier = session.user.email || session.user.name;

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has completed this job in database
    const { data: completion } = await supabase
      .from('job_completions')
      .select('id, completed_at, reward_amount')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single();

    // Also check contract-level completion status
    let contractCompleted = false;
    try {
      const validation = await jobValidator.canUserCompleteJob(jobId, user.wallet_address);
      contractCompleted = !validation.canComplete; // If can't complete, then already completed
    } catch (error) {
      console.error('Error checking contract completion:', error);
    }

    const hasCompleted = !!completion || contractCompleted;

    return NextResponse.json({
      hasCompleted,
      completionDetails: completion ? {
        completedAt: completion.completed_at,
        rewardAmount: completion.reward_amount
      } : null,
      contractCompleted
    });

  } catch (error) {
    console.error('Error checking completion status:', error);
    return NextResponse.json({ error: 'Failed to check completion status' }, { status: 500 });
  }
}