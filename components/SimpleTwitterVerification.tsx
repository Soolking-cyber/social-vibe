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

  const [beforeCounts, setBeforeCounts] = useState<any>(null);

  const handleOpenTwitter = async () => {
    if (!userTwitterHandle) {
      setErrorMessage('Twitter handle required for verification');
      setStep('error');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      // Phase 1: Start verification and get before counts
      const startResponse = await fetch('/api/jobs/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId: job.id,
          phase: 'start'
        })
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error || 'Failed to start verification');
      }

      const startResult = await startResponse.json();
      console.log('🚀 Phase 1 complete:', startResult);

      // Store before counts for phase 2
      setBeforeCounts(startResult.beforeCounts);

      // Open Twitter and move to verify step
      window.open(job.targetUrl, '_blank', 'noopener,noreferrer');
      setStep('verify');

    } catch (error) {
      console.error('Failed to start verification:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start verification');
      setStep('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = async () => {
    if (!userTwitterHandle || !beforeCounts) {
      setErrorMessage('Verification session not found. Please start over.');
      setStep('error');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      // Phase 2: Verify the action completion
      const verifyResponse = await fetch('/api/jobs/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId: job.id,
          phase: 'verify',
          beforeCounts: beforeCounts
        })
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        
        if (errorData.phase === 'verification_failed') {
          // Show detailed verification failure info
          const details = errorData.details;
          throw new Error(`${errorData.error}\n\nBefore: ${details.beforeCounts[details.countType] || 0}\nAfter: ${details.afterCounts[details.countType] || 0}`);
        } else if (errorData.phase === 'expired') {
          throw new Error('Verification session expired. Please start over.');
        } else {
          throw new Error(errorData.error || 'Verification failed');
        }
      }

      const verifyResult = await verifyResponse.json();
      console.log('✅ Phase 2 complete:', verifyResult);

      // Success!
      setStep('success');
      setTimeout(() => {
        onVerified();
      }, 2000);

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
            disabled={!userTwitterHandle || isVerifying}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Starting verification...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Complete {actionLabels[job.actionType]}
              </>
            )}
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
            Ready to Verify {actionLabels[job.actionType]}
          </h3>
          <p className="text-slate-400 text-sm">
            Complete the {job.actionType} action on Twitter, then click "Verify" to confirm and earn your reward.
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
                Verifying {job.actionType}...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Verify {actionLabels[job.actionType]} & Earn {job.reward} USDC
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
            onClick={() => {
              setStep('complete');
              setBeforeCounts(null);
              setErrorMessage('');
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  return null;
}