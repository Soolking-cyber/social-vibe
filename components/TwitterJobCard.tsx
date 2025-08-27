'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Twitter, Heart, Repeat, MessageCircle, DollarSign } from 'lucide-react';


interface TwitterJob {
  id: string;
  actionType: 'like' | 'retweet' | 'comment';
  targetUrl: string;
  reward: string;
  description: string;
  tweetPreview?: {
    author: string;
    content: string;
    timestamp: string;
  };
}

interface TwitterJobCardProps {
  job: TwitterJob;
  onJobCompleted: (jobId: string) => void;
}

export function TwitterJobCard({ job, onJobCompleted }: TwitterJobCardProps) {
  const [showVerification, setShowVerification] = useState(false);

  const actionIcons = {
    like: Heart,
    retweet: Repeat,
    comment: MessageCircle
  };

  const actionColors = {
    like: 'text-red-500',
    retweet: 'text-green-500', 
    comment: 'text-blue-500'
  };

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    comment: '💬'
  };

  const ActionIcon = actionIcons[job.actionType];

  return (
    <>
      <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Twitter className="h-5 w-5 text-blue-500" />
              <span className="text-lg">
                {actionEmojis[job.actionType]} {job.actionType.charAt(0).toUpperCase() + job.actionType.slice(1)} Tweet
              </span>
            </div>
            <div className="flex items-center gap-1 bg-green-900/20 border border-green-700 px-3 py-1 rounded-full">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-medium">{job.reward} USDC</span>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Job Description */}
          <p className="text-slate-300 text-sm">
            {job.description}
          </p>

          {/* Tweet Preview (if available) */}
          {job.tweetPreview && (
            <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                  <Twitter className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium text-sm">{job.tweetPreview.author}</p>
                  <p className="text-slate-500 text-xs">{job.tweetPreview.timestamp}</p>
                </div>
              </div>
              <p className="text-slate-300 text-sm">
                {job.tweetPreview.content}
              </p>
            </div>
          )}

          {/* Action Requirements */}
          <div className="flex items-center gap-3 p-3 bg-slate-900/30 border border-slate-700 rounded-lg">
            <ActionIcon className={`h-5 w-5 ${actionColors[job.actionType]}`} />
            <div className="flex-1">
              <p className="text-slate-300 text-sm font-medium">
                Required Action: {job.actionType.charAt(0).toUpperCase() + job.actionType.slice(1)}
              </p>
              <p className="text-slate-500 text-xs">
                {job.actionType === 'like' && 'Click the heart button on the tweet'}
                {job.actionType === 'retweet' && 'Retweet to your followers'}
                {job.actionType === 'comment' && 'Leave a meaningful comment'}
              </p>
            </div>
          </div>

          {/* Action Button or Verification */}
          {!showVerification ? (
            <Button
              onClick={() => setShowVerification(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
            >
              <ActionIcon className="h-4 w-4 mr-2" />
              Complete {job.actionType.charAt(0).toUpperCase() + job.actionType.slice(1)} Job
            </Button>
          ) : (
            <div className="space-y-3 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
              <p className="text-slate-300 text-sm">
                Verification functionality has been simplified. Please complete the action manually.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onJobCompleted(job.id);
                    setShowVerification(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Mark as Completed
                </Button>
                <Button
                  onClick={() => setShowVerification(false)}
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Additional Info */}
          {!showVerification && (
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Direct verification • No popups</span>
              <span>Instant USDC payout</span>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// Example usage component
export function TwitterJobsMarketplace() {
  const [jobs, setJobs] = useState<TwitterJob[]>([
    {
      id: '1',
      actionType: 'like',
      targetUrl: 'https://twitter.com/elonmusk/status/1234567890',
      reward: '0.05',
      description: 'Like this tweet about sustainable energy and earn USDC!',
      tweetPreview: {
        author: '@elonmusk',
        content: 'Sustainable energy is the future. Tesla is leading the charge! ⚡🚗',
        timestamp: '2h ago'
      }
    },
    {
      id: '2', 
      actionType: 'retweet',
      targetUrl: 'https://twitter.com/openai/status/1234567891',
      reward: '0.08',
      description: 'Retweet this announcement about AI safety research.',
      tweetPreview: {
        author: '@openai',
        content: 'Excited to announce our latest research on AI alignment and safety. The future of AI depends on getting this right. 🤖🔬',
        timestamp: '4h ago'
      }
    },
    {
      id: '3',
      actionType: 'comment',
      targetUrl: 'https://twitter.com/vitalikbuterin/status/1234567892', 
      reward: '0.12',
      description: 'Leave a thoughtful comment on this Ethereum update.',
      tweetPreview: {
        author: '@VitalikButerin',
        content: 'Ethereum 2.0 staking rewards are looking great! The network is more secure and efficient than ever. 🚀',
        timestamp: '6h ago'
      }
    }
  ]);

  const handleJobCompleted = (jobId: string) => {
    // Remove completed job from the list
    setJobs(prev => prev.filter(job => job.id !== jobId));
    
    // In a real app, you'd also:
    // - Update user balance
    // - Record completion in database
    // - Show success notification
    console.log(`Job ${jobId} completed successfully!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            🐦 Twitter Jobs Marketplace
          </h1>
          <p className="text-slate-400">
            Complete Twitter actions and earn USDC instantly with embedded verification
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map(job => (
            <TwitterJobCard
              key={job.id}
              job={job}
              onJobCompleted={handleJobCompleted}
            />
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              All Jobs Completed!
            </h2>
            <p className="text-slate-400">
              Great work! Check back later for more earning opportunities.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}