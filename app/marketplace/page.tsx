'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import UserDashboard from '../../components/UserDashboard';
import { TwitterActionVerifier } from '../../components/TwitterActionVerifier';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Job {
    id: number;
    creator: string;
    tweetUrl: string;
    actionType: 'like' | 'repost' | 'comment';
    pricePerAction: string; // Contract returns string
    maxActions: number;
    completedActions: number;
    totalBudget: string; // Contract returns string
    commentText: string;
    isActive: boolean;
    createdAt: string;
    remainingActions: number;
    hasUserCompleted?: boolean;
    canComplete?: boolean;
    isOwnJob?: boolean;
}

export default function Marketplace() {
    const { data: session } = useSession();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [completingJobs, setCompletingJobs] = useState<Set<number>>(new Set());
    const [verifyingJobs, setVerifyingJobs] = useState<Set<number>>(new Set());
    const [sortBy, setSortBy] = useState<'status' | 'newest' | 'price'>('status');
    const [popupJob, setPopupJob] = useState<Job | null>(null);
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        fetchJobs();
    }, []);

    const refreshBalances = async () => {
        try {
            console.log('Refreshing balances from marketplace...');
            await fetch('/api/wallet/refresh', { method: 'POST' });
            // Trigger a page refresh to update all components
            window.location.reload();
        } catch (error) {
            console.error('Error refreshing balances:', error);
        }
    };

    const fetchJobs = async () => {
        try {
            const response = await fetch('/api/jobs');
            const data = await response.json();

            if (Array.isArray(data) && session?.user) {
                // Get user stats to determine user's wallet address
                const userResponse = await fetch('/api/user/stats');
                const userData = await userResponse.json();
                const userWalletAddress = userData.wallet?.address?.toLowerCase();

                // Filter and enhance jobs
                const filteredJobs = data
                    .filter(job => {
                        // Only show jobs from other users (not user's own jobs)
                        return job.creator.toLowerCase() !== userWalletAddress;
                    })
                    .map(job => ({
                        ...job,
                        isOwnJob: job.creator.toLowerCase() === userWalletAddress,
                        hasUserCompleted: false, // Will be checked individually
                        canComplete: job.isActive && job.remainingActions > 0
                    }));

                // Check completion status for each job
                const jobsWithCompletion = await Promise.all(
                    filteredJobs.map(async (job) => {
                        try {
                            const completionResponse = await fetch(`/api/jobs/${job.id}/completion-status`);
                            if (completionResponse.ok) {
                                const completionData = await completionResponse.json();
                                return {
                                    ...job,
                                    hasUserCompleted: completionData.hasCompleted,
                                    canComplete: job.canComplete && !completionData.hasCompleted
                                };
                            }
                        } catch (error) {
                            console.error(`Error checking completion for job ${job.id}:`, error);
                        }
                        return job;
                    })
                );

                setJobs(jobsWithCompletion);
            } else {
                console.error('API returned non-array data:', data);
                setJobs([]);
            }
        } catch (error) {
            console.error('Error fetching jobs:', error);
            setJobs([]);
        } finally {
            setLoading(false);
        }
    };

    const openTwitterAction = async (jobId: number) => {
        try {
            setCompletingJobs(prev => new Set(prev).add(jobId));

            // Get job details first
            const jobResponse = await fetch(`/api/jobs/${jobId}`);
            if (!jobResponse.ok) {
                alert('Failed to get job details');
                return;
            }

            const job = await jobResponse.json();
            setPopupJob(job);
            setShowPopup(true);

        } catch (error) {
            console.error('Error getting job details:', error);
            alert('Failed to get job details. Please try again.');
        } finally {
            setCompletingJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(jobId);
                return newSet;
            });
        }
    };

    const handlePopupVerified = async () => {
        if (!popupJob) return;

        try {
            setVerifyingJobs(prev => new Set(prev).add(popupJob.id));

            // Call the completion API
            const response = await fetch('/api/jobs/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: popupJob.id.toString() })
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Success! You earned ${result.rewardAmount} USDC. ${result.message}`);

                // Update the specific job to show as completed
                setJobs(prevJobs =>
                    prevJobs.map(job =>
                        job.id === popupJob.id
                            ? { ...job, hasUserCompleted: true, canComplete: false }
                            : job
                    )
                );

                // Close popup
                setShowPopup(false);
                setPopupJob(null);
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Error verifying completion:', error);
            alert('Failed to verify completion. Please try again.');
        } finally {
            setVerifyingJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(popupJob.id);
                return newSet;
            });
        }
    };

    const handlePopupClose = () => {
        setShowPopup(false);
        setPopupJob(null);
    };

    // Function to get job status for sorting
    const getJobStatus = (job: Job) => {
        if (job.hasUserCompleted) return 'completed';
        if (job.isOwnJob) return 'created';
        if (job.canComplete) return 'incomplete';
        return 'unavailable';
    };

    // Sort jobs based on selected criteria
    const sortedJobs = [...jobs].sort((a, b) => {
        if (sortBy === 'status') {
            // Priority order: incomplete (1), created (2), completed (3)
            const statusOrder = { incomplete: 1, created: 2, completed: 3, unavailable: 4 };
            const aStatus = getJobStatus(a);
            const bStatus = getJobStatus(b);

            if (statusOrder[aStatus] !== statusOrder[bStatus]) {
                return statusOrder[aStatus] - statusOrder[bStatus];
            }
            // If same status, sort by newest
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else if (sortBy === 'newest') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else if (sortBy === 'price') {
            return parseFloat(b.pricePerAction) - parseFloat(a.pricePerAction);
        }
        return 0;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-300">Loading marketplace...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-4">Marketplace</h1>
                    <p className="text-slate-400 text-lg">Discover engagement opportunities and start earning</p>
                </div>

                {session && <UserDashboard onRefresh={refreshBalances} />}

                {/* Sorting Controls */}
                {jobs.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-4">
                            <div className="flex items-center space-x-4">
                                <span className="text-white font-medium">Sort by:</span>
                                <div className="flex space-x-2">
                                    <Button
                                        onClick={() => setSortBy('status')}
                                        variant={sortBy === 'status' ? 'default' : 'outline'}
                                        size="sm"
                                        className={sortBy === 'status'
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                                        }
                                    >
                                        Status
                                    </Button>
                                    <Button
                                        onClick={() => setSortBy('newest')}
                                        variant={sortBy === 'newest' ? 'default' : 'outline'}
                                        size="sm"
                                        className={sortBy === 'newest'
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                                        }
                                    >
                                        Newest
                                    </Button>
                                    <Button
                                        onClick={() => setSortBy('price')}
                                        variant={sortBy === 'price' ? 'default' : 'outline'}
                                        size="sm"
                                        className={sortBy === 'price'
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                                        }
                                    >
                                        Price
                                    </Button>
                                </div>
                            </div>
                            <div className="text-slate-400 text-sm">
                                {(() => {
                                    const counts = jobs.reduce((acc, job) => {
                                        const status = getJobStatus(job);
                                        acc[status] = (acc[status] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>);

                                    const parts = [];
                                    if (counts.incomplete) parts.push(`${counts.incomplete} available`);
                                    if (counts.created) parts.push(`${counts.created} created by you`);
                                    if (counts.completed) parts.push(`${counts.completed} completed`);

                                    return parts.length > 0 ? parts.join(' • ') : `${jobs.length} jobs`;
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Jobs List */}
                <div className="space-y-6">
                    {sortedJobs.map((job) => {
                        const jobStatus = getJobStatus(job);
                        return (
                            <Card key={job.id} className={`bg-slate-900 border-slate-800 ${jobStatus === 'incomplete' ? 'ring-2 ring-blue-500/20' :
                                    jobStatus === 'created' ? 'ring-2 ring-purple-500/20' :
                                        jobStatus === 'completed' ? 'ring-2 ring-green-500/20' : ''
                                }`}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center space-x-2 mb-2">
                                                <CardTitle className="text-white capitalize">
                                                    {job.actionType} Job
                                                </CardTitle>
                                                {/* Status Badge */}
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        jobStatus === 'incomplete' ? 'border-blue-500 text-blue-400 bg-blue-500/10' :
                                                            jobStatus === 'created' ? 'border-purple-500 text-purple-400 bg-purple-500/10' :
                                                                jobStatus === 'completed' ? 'border-green-500 text-green-400 bg-green-500/10' :
                                                                    'border-slate-500 text-slate-400 bg-slate-500/10'
                                                    }
                                                >
                                                    {jobStatus === 'incomplete' ? 'Available' :
                                                        jobStatus === 'created' ? 'Your Job' :
                                                            jobStatus === 'completed' ? 'Completed' : 'Unavailable'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <span className="text-2xl font-bold text-green-400">
                                                    ${parseFloat(job.pricePerAction).toFixed(3)}
                                                </span>
                                                <span className="text-slate-400">per {job.actionType}</span>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={job.isActive ? 'default' : 'secondary'}
                                            className={job.isActive ? 'bg-green-600' : 'bg-slate-600'}
                                        >
                                            {job.isActive ? 'active' : 'completed'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Tweet URL */}
                                    <div className="bg-slate-800 p-3 rounded-lg">
                                        <p className="text-sm text-slate-400 mb-1">Tweet URL:</p>
                                        <a
                                            href={job.tweetUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 text-sm break-all"
                                        >
                                            {job.tweetUrl}
                                        </a>
                                    </div>

                                    {/* Comment Text */}
                                    {job.commentText && job.commentText.trim() && (
                                        <div className="bg-blue-900/20 border border-blue-800 p-3 rounded-lg">
                                            <p className="text-sm text-blue-400 mb-1">Comment to post:</p>
                                            <p className="text-white text-sm">"{job.commentText}"</p>
                                        </div>
                                    )}

                                    {/* Progress */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">
                                                Progress: {job.completedActions}/{job.maxActions}
                                            </span>
                                            <span className="text-slate-400">
                                                ${(parseFloat(job.totalBudget) - (job.completedActions * parseFloat(job.pricePerAction))).toFixed(2)} remaining
                                            </span>
                                        </div>
                                        <Progress
                                            value={(job.completedActions / job.maxActions) * 100}
                                            className="h-2"
                                        />
                                    </div>

                                    {/* Action Buttons */}
                                    {session && job.isActive && job.remainingActions > 0 && (
                                        <div className="space-y-2">
                                            {job.hasUserCompleted ? (
                                                // Job completed - show success state
                                                <Button
                                                    disabled
                                                    className="w-full bg-green-600 text-white cursor-not-allowed"
                                                >
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Completed - Earned ${parseFloat(job.pricePerAction).toFixed(3)}
                                                </Button>
                                            ) : (
                                                // Job not completed - show action buttons
                                                <>
                                                    <Button
                                                        onClick={() => openTwitterAction(job.id)}
                                                        disabled={completingJobs.has(job.id) || verifyingJobs.has(job.id)}
                                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                                    >
                                                        {completingJobs.has(job.id) ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                Loading...
                                                            </div>
                                                        ) : verifyingJobs.has(job.id) ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                Verifying...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                </svg>
                                                                Complete {job.actionType} - Earn ${parseFloat(job.pricePerAction).toFixed(3)} USDC
                                                            </>
                                                        )}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Empty State */}
                {jobs.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <div className="text-slate-400 mb-4">
                            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No jobs available</h3>
                        <p className="text-slate-400 mb-4">Check back later for new opportunities</p>
                        <Button onClick={fetchJobs} variant="outline" className="border-slate-700 text-slate-300">
                            Refresh
                        </Button>
                    </div>
                )}
            </div>

            {/* Twitter Action Verifier */}
            {popupJob && (
                <TwitterActionVerifier
                    isOpen={showPopup}
                    onClose={handlePopupClose}
                    onVerified={handlePopupVerified}
                    tweetUrl={popupJob.tweetUrl}
                    actionType={popupJob.actionType}
                    commentText={popupJob.commentText}
                />
            )}
        </div>
    );
}