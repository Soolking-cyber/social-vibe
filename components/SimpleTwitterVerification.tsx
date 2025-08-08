'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Twitter, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface SimpleTwitterVerificationProps {
  job: {
    id: string;
    actionType: 'like' | 'retweet' | 'comment';
    targetUrl: string;
    reward: string;
  };
  onVerified: () => void;
  onCancel: () => void;
}

export function SimpleTwitterVerification({ job, onVerified, onCancel }: SimpleTwitterVerificationProps) {
  const [step, setStep] = useState<'complete' | 'verify' | 'success' | 'error'>('complete');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userTwitterHandle, setUserTwitterHandle] = useState<string>('');
  const [isLoadingHandle, setIsLoadingHandle] = useState(true);

  const { data: session } = useSession();

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    comment: '💬'
  };

  const actionLabels = {
    like: 'Like',
    retweet: 'Retweet', 
    comment: 'Comment'
  };

  // Fetch user's Twitter handle
  useEffect(() => {
    const fetchTwitterHandle = async () => {
      if (!session?.user) {
        setIsLoadingHandle(false);
        return;
      }

      // Try session first
      const sessionHandle = (session.user as any).twitterHandle;
      if (sessionHandle) {
        setUserTwitterHandle(sessionHandle);
        setIsLoadingHandle(false);
        return;
      }

      // Try session name
      if (session.user.name && session.user.name.startsWith('@')) {
        const handleFromName = session.user.name.replace('@', '');
        setUserTwitterHandle(handleFromName);
        setIsLoadingHandle(false);
        return;
      }

      // Try API
      try {
        const response = await fetch('/api/user/twitter-handle');
        if (response.ok) {
          const data = await response.json();
          if (data.twitterHandle) {
            setUserTwitterHandle(data.twitterHandle);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Twitter handle:', error);
      } finally {
        setIsLoadingHandle(false);
      }
    };

    fetchTwitterHandle();
  }, [session]);

  const handleOpenTwitter = () => {
    window.open(job.targetUrl, '_blank', 'noopener,noreferrer');
    setStep('verify');
  };

  const handleVerify = async () => {
    if (!userTwitterHandle) {
      setErrorMessage('Twitter handle required for verification');
      setStep('error');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      // Extract tweet ID
      const tweetIdMatch = job.targetUrl.match(/status\/(\d+)/);
      if (!tweetIdMatch) {
        throw new Error('Invalid tweet URL');
      }
      const tweetId = tweetIdMatch[1];

      // Map action types
      let apiAction = '';
      if (job.actionType === 'like') apiAction = 'verifyLike';
      else if (job.actionType === 'retweet') apiAction = 'verifyRetweet';
      else if (job.actionType === 'comment') apiAction = 'verifyReply';

      // For likes, try multiple times with delays (TwitterAPI.io can be slow to update)
      let maxRetries = job.actionType === 'like' ? 3 : 1;
      let verified = false;
      let lastResult = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🔍 Verification attempt ${attempt}/${maxRetries} for ${job.actionType}`);
        
        // Add delay between attempts (except first)
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Verify the action
        const response = await fetch('/api/twitterapi-io-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userTwitterHandle,
            action: apiAction,
            tweetId: tweetId
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Verification failed');
        }

        const result = await response.json();
        lastResult = result;
        console.log(`🔍 Verification attempt ${attempt} result:`, result);
        
        if (result.success && result.verified) {
          verified = true;
          break;
        }
      }
      
      if (verified) {
        // Complete the job
        const jobResponse = await fetch('/api/jobs/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id })
        });

        if (jobResponse.ok) {
          setStep('success');
          setTimeout(() => {
            onVerified();
          }, 2000);
        } else {
          const jobError = await jobResponse.json();
          throw new Error(jobError.error || 'Failed to complete job');
        }
      } else {
        // Show more detailed error message
        const errorMsg = lastResult?.message || `Please ${job.actionType} the tweet first, then try again. If you just ${job.actionType}d it, wait a moment and try again.`;
        console.error('❌ Verification failed after all attempts:', lastResult);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Verification failed');
      setStep('error');
    } finally {
      setIsVerifying(false);
    }
  };

  if (step === 'complete') {
    return (
      <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <div className="text-center">
          <div className="text-4xl mb-2">{actionEmojis[job.actionType]}</div>
          <h3 className="text-white font-medium mb-2">
            {actionLabels[job.actionType]} this Tweet
          </h3>
          <p className="text-slate-400 text-sm">
            Click below to open Twitter and complete the action
          </p>
        </div>

        {isLoadingHandle ? (
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-slate-300 text-sm">Loading your Twitter handle...</span>
            </div>
          </div>
        ) : userTwitterHandle ? (
          <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
            <div className="flex items-center gap-2 text-green-300">
              <Twitter className="h-4 w-4" />
              <span className="text-sm">Ready to verify as @{userTwitterHandle}</span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <div className="text-red-300 text-sm mb-2">Twitter handle required</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="@username"
                className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                onChange={(e) => {
                  const handle = e.target.value.replace('@', '');
                  if (handle) setUserTwitterHandle(handle);
                }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleOpenTwitter}
            disabled={!userTwitterHandle}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Tweet & {actionLabels[job.actionType]}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="text-white font-medium mb-2">
            Ready to Verify
          </h3>
          <p className="text-slate-400 text-sm">
            Did you {job.actionType} the tweet? Click verify to check and earn your reward.
          </p>
        </div>

        <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
          <div className="flex items-center gap-2 text-blue-300">
            <Twitter className="h-4 w-4" />
            <span className="text-sm">Verifying as @{userTwitterHandle}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => setStep('complete')}
            variant="outline"
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            disabled={isVerifying}
          >
            Back
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {job.actionType === 'like' ? 'Checking if you liked it...' : 'Verifying...'}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Verify & Earn {job.reward} USDC
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="space-y-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
        <div className="text-center">
          <div className="text-6xl mb-2">🎉</div>
          <h3 className="text-green-400 font-bold text-lg mb-2">
            Job Completed!
          </h3>
          <p className="text-green-300">
            You earned {job.reward} USDC!
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Reward added to your balance
          </p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="space-y-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
        <div className="text-center">
          <div className="text-4xl mb-2">❌</div>
          <h3 className="text-red-400 font-medium mb-2">
            Verification Failed
          </h3>
          <p className="text-red-300 text-sm">
            {errorMessage}
          </p>
        </div>

        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <p className="text-sm text-slate-300 mb-2">
            <strong>Troubleshooting:</strong>
          </p>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Make sure you actually {job.actionType}d the tweet</li>
            <li>• Wait 10-30 seconds after {job.actionType}ing, then try again</li>
            <li>• Check that your Twitter handle is correct: @{userTwitterHandle}</li>
            <li>• Try refreshing the page if the issue persists</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={() => setStep('complete')}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return null;
}