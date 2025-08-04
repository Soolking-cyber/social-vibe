import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { jobValidator } from '@/lib/job-validation';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('=== FETCHING JOBS FROM CONTRACT ===');
    
    try {
      const jobs = await jobValidator.getActiveJobs();
      console.log(`Successfully fetched ${jobs.length} jobs from contract`);
      
      return NextResponse.json(jobs);
      
    } catch (contractError) {
      console.error('Contract interaction failed:', contractError);
      return NextResponse.json({ 
        error: `Failed to fetch jobs from contract: ${contractError instanceof Error ? contractError.message : 'Unknown error'}` 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}