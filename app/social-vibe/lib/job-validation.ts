import { createJobsFactoryService } from './contract';

export interface ContractJob {
  id: number;
  creator: string;
  tweetUrl: string;
  actionType: string;
  pricePerAction: string;
  maxActions: number;
  completedActions: number;
  totalBudget: string;
  commentText: string;
  isActive: boolean;
  createdAt: string;
  remainingActions: number;
}

export class JobValidator {
  private jobsFactoryService;

  constructor() {
    this.jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
  }

  /**
   * Fetch job details from contract
   */
  async getJobFromContract(jobId: number): Promise<ContractJob | null> {
    try {
      const jobDetails = await this.jobsFactoryService.getJob(jobId);
      
      // Check if job exists (creator address is not zero)
      if (jobDetails.creator === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      
      return {
        id: jobId,
        creator: jobDetails.creator,
        tweetUrl: jobDetails.tweetUrl,
        actionType: jobDetails.actionType,
        pricePerAction: this.jobsFactoryService.formatUSDC(jobDetails.pricePerAction),
        maxActions: Number(jobDetails.maxActions),
        completedActions: Number(jobDetails.completedActions),
        totalBudget: this.jobsFactoryService.formatUSDC(jobDetails.totalBudget),
        commentText: jobDetails.commentText,
        isActive: jobDetails.isActive,
        createdAt: new Date(Number(jobDetails.createdAt) * 1000).toISOString(),
        remainingActions: Number(jobDetails.maxActions) - Number(jobDetails.completedActions)
      };
    } catch (error) {
      console.error(`Error fetching job ${jobId} from contract:`, error);
      return null;
    }
  }

  /**
   * Validate if user can complete a job
   */
  async canUserCompleteJob(jobId: number, userWalletAddress: string): Promise<{
    canComplete: boolean;
    reason?: string;
  }> {
    try {
      const job = await this.getJobFromContract(jobId);
      
      if (!job) {
        return { canComplete: false, reason: 'Job not found' };
      }

      if (!job.isActive) {
        return { canComplete: false, reason: 'Job is not active' };
      }

      if (job.remainingActions <= 0) {
        return { canComplete: false, reason: 'Job has no remaining actions' };
      }

      if (job.creator.toLowerCase() === userWalletAddress.toLowerCase()) {
        return { canComplete: false, reason: 'Cannot complete your own job' };
      }

      // Check if user has already completed this job
      const hasCompleted = await this.jobsFactoryService.hasUserCompletedJob(jobId, userWalletAddress);
      if (hasCompleted) {
        return { canComplete: false, reason: 'You have already completed this job' };
      }

      return { canComplete: true };
    } catch (error) {
      console.error(`Error validating job completion for job ${jobId}:`, error);
      return { canComplete: false, reason: 'Validation failed' };
    }
  }

  /**
   * Get all active jobs from contract
   */
  async getActiveJobs(): Promise<ContractJob[]> {
    try {
      const activeJobIds = await this.jobsFactoryService.getActiveJobs();
      const jobs: ContractJob[] = [];
      
      for (const jobId of activeJobIds) {
        const job = await this.getJobFromContract(Number(jobId));
        if (job) {
          jobs.push(job);
        }
      }
      
      // Sort by creation date (newest first)
      jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return jobs;
    } catch (error) {
      console.error('Error fetching active jobs:', error);
      return [];
    }
  }
}

// Export singleton instance
export const jobValidator = new JobValidator();