'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Twitter, Sparkles, AlertTriangle } from 'lucide-react';
import { twitterAPIIOVerifier, TwitterAPIIOVerificationResult } from '@/lib/twitterapi-io-verification';
import { VerificationStatus } from './VerificationStatus';

interface TwitterActionVerifierProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'comment';
  commentText?: string;
  jobId?: string; // Add jobId for server verification
}

export function TwitterActionVerifier({
  isOpen,
  onClose,
  onVerified,
  tweetUrl,
  actionType,
  commentText,
  jobId
}: TwitterActionVerifierProps) {
  const [step, setStep] = useState<'ready' | 'completed' | 'verified' | 'failed'>('ready');
  const [isVerifying, setIsVerifying] = useState(false);

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<TwitterAPIIOVerificationResult | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const extractTweetId = (url: string): string => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : '';
  };

  const getActionUrl = () => {
    const tweetId = extractTweetId(tweetUrl);

    switch (actionType) {
      case 'like':
        return `https://twitter.com/intent/like?tweet_id=${tweetId}`;
      case 'retweet':
        return `https://twitter.com/intent/retweet?tweet_id=${tweetId}`;
      case 'comment':
        const encodedComment = encodeURIComponent(commentText || '');
        return `https://twitter.com/intent/tweet?in_reply_to=${tweetId}&text=${encodedComment}`;
      default:
        return tweetUrl;
    }
  };

  const handleCompleteAction = async () => {
    const url = getActionUrl();

    // For TwitterAPI.io verification, we need a Twitter handle
    // This component should be updated to get the Twitter handle from session/API
    // For now, we'll use a placeholder approach

    try {
      // Get Twitter handle from API
      const response = await fetch('/api/user/twitter-handle');
      const data = await response.json();

      if (!data.twitterHandle) {
        alert('Twitter handle required for verification. Please ensure you\'re logged in with Twitter.');
        return;
      }

      // Start TwitterAPI.io verification
      const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
      const verifyId = await twitterAPIIOVerifier.startVerification(
        tweetUrl,
        data.twitterHandle,
        normalizedActionType as 'like' | 'retweet' | 'reply'
      );

      setVerificationId(verifyId);
      setStartTime(Date.now());

      // IMMEDIATELY change to completed state when button is clicked
      setStep('completed');

      // Open Twitter - works universally on all platforms
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to start verification:', error);
      alert('Failed to initialize verification. Please try again.');
    }
  };

  const handleVerifyAction = async () => {
    // Simplified verification - just call the verification directly
    await handleVerify();
  };

  const handleVerify = async () => {
    if (!verificationId) {
      setStep('failed');
      return;
    }

    setIsVerifying(true);

    try {
      // Get Twitter handle for enhanced verification
      const handleResponse = await fetch('/api/user/twitter-handle');
      const handleData = await handleResponse.json();

      if (!handleData.twitterHandle) {
        setStep('failed');
        setVerificationResult({
          success: false,
          confidence: 'low',
          method: 'no_twitter_handle',
          details: 'Twitter handle required for verification'
        });
        return;
      }

      console.log(`🔍 Starting enhanced TwitterAPI.io verification...`);

      // First try the count-based verification (existing method)
      const countResult = await twitterAPIIOVerifier.verifyCompletion(verificationId);
      console.log('🔍 Count-based verification result:', countResult);

      // If count-based verification succeeds, we're done
      if (countResult.success) {
        console.log('✅ COUNT VERIFICATION SUCCESS:', countResult.details);
        setVerificationResult(countResult);
        setStep('verified');
        setTimeout(() => {
          onVerified();
        }, 1500);
        return;
      }

      // If count-based fails, try direct tweet interaction verification
      const tweetId = extractTweetId(tweetUrl);
      if (tweetId) {
        console.log(`🔍 Trying direct tweet interaction verification for ${actionType}...`);

        // Map action types to API actions
        let apiAction = '';
        if (actionType === 'like') apiAction = 'verifyLike';
        else if (actionType === 'retweet') apiAction = 'verifyRetweet';
        else if (actionType === 'comment') apiAction = 'verifyReply';

        if (apiAction) {
          const directVerificationResponse = await fetch('/api/twitterapi-io-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: handleData.twitterHandle,
              action: apiAction,
              tweetId: tweetId
            })
          });

          if (directVerificationResponse.ok) {
            const directResult = await directVerificationResponse.json();
            console.log('🔍 Direct verification result:', directResult);

            if (directResult.success && directResult.verified) {
              console.log('✅ DIRECT VERIFICATION SUCCESS:', directResult.message);
              setVerificationResult({
                success: true,
                confidence: 'high',
                method: 'direct_tweet_check',
                details: directResult.message
              });
              setStep('verified');
              setTimeout(() => {
                onVerified();
              }, 1500);
              return;
            }
          }
        }
      }

      // Both verification methods failed
      console.error('❌ ALL VERIFICATION METHODS FAILED');
      setVerificationResult({
        success: false,
        confidence: 'high',
        method: 'all_methods_failed',
        details: `Could not confirm your ${actionType} action. Please ensure you completed the action on Twitter and try again.`
      });
      setStep('failed');

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        success: false,
        confidence: 'low',
        method: 'verification_error',
        details: 'Verification service may be unavailable. Please try again.'
      });
      setStep('failed');
    } finally {
      setIsVerifying(false);
    }
  };



  const handleClose = () => {
    setStep('ready');
    setIsVerifying(false);
    setVerificationId(null);
    setVerificationResult(null);
    setStartTime(null);
    onClose();
  };

  // Timer effect for tracking (simplified)
  useEffect(() => {
    // Timer logic can be added here if needed for verification timing
  }, [startTime, step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup logic if needed
    };
  }, []);

  const actionInstructions = {
    like: 'Like the tweet ❤️',
    retweet: 'Retweet the post 🔄',
    comment: 'Reply to the tweet 💬'
  };

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    comment: '💬'
  };

  const actionButtons = {
    like: 'Like Tweet',
    retweet: 'Retweet',
    comment: 'Reply'
  };



  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Twitter className="h-5 w-5 text-blue-500" />
            Complete Twitter Action
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Verification Status - Always Visible */}
          <VerificationStatus verificationId={verificationId || undefined} />

          {step === 'ready' && (
            <div className="text-center space-y-4">
              <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="text-6xl mb-4">{actionEmojis[actionType]}</div>
                <p className="text-lg text-slate-200 font-medium mb-2">
                  {actionInstructions[actionType]}
                </p>
                {commentText && (
                  <div className="mt-4 p-3 bg-slate-700/50 rounded border border-slate-600">
                    <p className="text-xs text-slate-400 mb-1">Comment to post:</p>
                    <p className="text-sm font-mono text-slate-200">"{commentText}"</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <p className="text-sm text-blue-300">
                  <Sparkles className="h-4 w-4 inline mr-2" />
                  Click below to open Twitter and complete the action manually
                </p>
              </div>

              <Button onClick={handleCompleteAction} className="w-full bg-blue-600 hover:bg-blue-700 py-3">
                <Twitter className="h-5 w-5 mr-2" />
                Complete {actionButtons[actionType]}
              </Button>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center space-y-6">
              <div className="relative">
                {isVerifying ? (
                  <div className="animate-pulse">
                    <CheckCircle className="h-20 w-20 mx-auto text-blue-500" />
                  </div>
                ) : (
                  <CheckCircle className="h-20 w-20 mx-auto text-green-500" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-24 h-24 border-4 ${isVerifying ? 'border-blue-500/20' : 'border-green-500/20'} rounded-full animate-ping`}></div>
                </div>
              </div>

              <div>
                {isVerifying ? (
                  <>
                    <p className="font-medium text-white text-lg">Verifying Action...</p>
                    <p className="text-sm text-slate-400 mt-2">
                      We opened Twitter to verify your {actionType}. Close the tab when done.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-white text-lg">Action Completed!</p>
                    <p className="text-sm text-slate-400 mt-2">
                      Click verify below to confirm your {actionType} and earn USDC
                    </p>
                  </>
                )}
              </div>

              {isVerifying ? (
                <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-blue-300">
                    <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                    <span>🔍 Verifying your action...</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                  <p className="text-sm text-green-300">
                    💰 Click below to verify and earn your reward
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep('ready')}
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  disabled={isVerifying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifyAction}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify {actionButtons[actionType]}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}



          {step === 'verified' && (
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="animate-bounce">
                  <div className="text-8xl">🎉</div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 border-4 border-yellow-500/30 rounded-full animate-ping"></div>
                </div>
              </div>

              <div>
                <p className="font-bold text-yellow-400 text-2xl">Congratulations!</p>
                <p className="text-lg text-green-400 mt-2">
                  You earned USDC! 💰
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Your reward has been added to your balance
                </p>
              </div>

              <div className="p-6 bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700 rounded-lg">
                <p className="text-lg text-slate-200">
                  🚀 <strong>Mission Accomplished!</strong>
                </p>
                <p className="text-sm text-slate-300 mt-2">
                  Keep completing jobs to earn more USDC rewards
                </p>
              </div>
            </div>
          )}

          {step === 'failed' && (
            <div className="text-center space-y-4">
              <div className="relative">
                <AlertTriangle className="h-16 w-16 mx-auto text-red-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border-4 border-red-500/30 rounded-full animate-ping"></div>
                </div>
              </div>

              <div>
                <p className="font-medium text-red-400 text-lg">Verification Failed</p>
                <p className="text-sm text-slate-400 mt-2">
                  We couldn't verify that you completed the {actionType} action on Twitter
                </p>
              </div>

              {verificationResult && (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-300">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    {verificationResult.details}
                  </p>
                </div>
              )}

              <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <p className="text-sm text-blue-300 mb-2">
                  <strong>🔍 Enhanced Verification:</strong>
                </p>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• Count increase detection</li>
                  <li>• Direct tweet interaction check</li>
                  <li>• Professional TwitterAPI.io service</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-300 mb-2">
                  <strong>⚠️ Important:</strong>
                </p>
                <p className="text-sm text-slate-400">
                  Only claim rewards for actions you actually completed.
                  False claims may result in account suspension.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('ready')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}