import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { createJobsFactoryService } from '@/lib/contract';

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

    console.log(`=== FETCHING JOB ${jobId} FROM CONTRACT ===`);
    
    // Initialize contract service
    const jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
    
    try {
      // Get job details from contract
      const jobDetails = await jobsFactoryService.getJob(jobId);
      
      // Check if job exists (creator address is not zero)
      if (jobDetails.creator === '0x0000000000000000000000000000000000000000') {
        return NextResponse.json({
          error: 'Job not found'
        }, { status: 404 });
      }
      
      // Get user identifier for completion check
      const userIdentifier = session.user.email || session.user.name;
      
      // Get user wallet address for completion check
      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('name', userIdentifier)
        .single();
      
      let hasUserCompleted = false;
      if (user?.wallet_address) {
        hasUserCompleted = await jobsFactoryService.hasUserCompletedJob(jobId, user.wallet_address);
      }
      
      // Format job data for frontend
      const formattedJob = {
        id: jobId,
        creator: jobDetails.creator,
        tweetUrl: jobDetails.tweetUrl,
        actionType: jobDetails.actionType,
        pricePerAction: jobsFactoryService.formatUSDC(jobDetails.pricePerAction),
        maxActions: Number(jobDetails.maxActions),
        completedActions: Number(jobDetails.completedActions),
        totalBudget: jobsFactoryService.formatUSDC(jobDetails.totalBudget),
        commentText: jobDetails.commentText,
        isActive: jobDetails.isActive,
        createdAt: new Date(Number(jobDetails.createdAt) * 1000).toISOString(),
        remainingActions: Number(jobDetails.maxActions) - Number(jobDetails.completedActions),
        hasUserCompleted,
        canComplete: jobDetails.isActive && 
                    !hasUserCompleted && 
                    user?.wallet_address && 
                    jobDetails.creator.toLowerCase() !== user.wallet_address.toLowerCase()
      };
      
      console.log(`Successfully fetched job ${jobId} from contract`);
      
      return NextResponse.json(formattedJob);
      
    } catch (contractError) {
      console.error('Contract interaction failed:', contractError);
      return NextResponse.json({ 
        error: `Failed to fetch job from contract: ${contractError instanceof Error ? contractError.message : 'Unknown error'}` 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}