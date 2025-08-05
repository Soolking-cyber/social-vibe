'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Twitter, Sparkles, AlertTriangle } from 'lucide-react';
import { simpleVerifier, SimpleVerificationResult } from '@/lib/simple-verification';
import { browserVerifier } from '@/lib/browser-verification';
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
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<SimpleVerificationResult | null>(null);
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

  const handleCompleteAction = () => {
    const url = getActionUrl();

    // Start simple verification (works on all platforms)
    const verifyId = simpleVerifier.startVerification(actionType, tweetUrl);
    setVerificationId(verifyId);
    setStartTime(Date.now());

    // IMMEDIATELY change to completed state when button is clicked
    setStep('completed');

    // Open Twitter - works universally on all platforms
    window.open(url, '_blank');
  };

  const handleVerifyAction = () => {
    // Store current verification ID for the Twitter tab to access
    if (verificationId) {
      localStorage.setItem('current_verification_id', verificationId);
    }

    // Open Twitter again to check if the action was completed
    const tweetId = extractTweetId(tweetUrl);
    const verifyUrl = `https://twitter.com/status/${tweetId}?verification_id=${verificationId || ''}`;

    // Open Twitter to verify the action
    const verifyPopup = window.open(
      verifyUrl,
      'twitter-verify',
      'width=500,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no,left=' +
      (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
    );

    if (verifyPopup) {
      setPopupWindow(verifyPopup);
      setIsVerifying(true);

      // Listen for verification messages from the Twitter tab
      const handleVerificationMessage = (event: MessageEvent) => {
        if (event.data?.type === 'twitter_action_completed' &&
          event.data?.verificationId === verificationId &&
          event.data?.verified === true) {
          // Action was verified! Mark it in our system
          if (verificationId) {
            browserVerifier.markActionAsVerified(verificationId);
          }
          window.removeEventListener('message', handleVerificationMessage);
        }
      };

      window.addEventListener('message', handleVerificationMessage);

      // Monitor popup for closure and automatically verify
      const checkClosed = setInterval(() => {
        if (verifyPopup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleVerificationMessage);

          // Wait a moment for any final verification messages
          setTimeout(() => {
            handleVerify();
          }, 1000);
        }
      }, 1000);
    } else {
      // Fallback: open in new tab
      window.open(verifyUrl, '_blank');
      setIsVerifying(true);

      // For new tab, we'll need to rely on manual verification
      setTimeout(() => {
        handleVerify();
      }, 5000); // Give user time to complete action
    }
  };

  const handleVerify = async () => {
    if (!verificationId) {
      setStep('failed');
      return;
    }

    setIsVerifying(true);

    try {
      // First try enhanced verification (includes time analysis)
      const result = await browserVerifier.enhancedVerification(verificationId);

      // Convert VerificationResult to SimpleVerificationResult to match state type
      const simpleResult: SimpleVerificationResult = {
        success: result.success,
        confidence: result.confidence,
        method: result.method,
        details: result.details || 'No additional details available'
      };

      setVerificationResult(simpleResult);

      if (result.success && result.confidence === 'high') {
        // High confidence automatic verification
        setStep('verified');
        setTimeout(() => {
          onVerified();
        }, 1500);
      } else if (result.success && result.confidence === 'medium') {
        // Medium confidence - show result but still proceed
        setStep('verified');
        setTimeout(() => {
          onVerified();
        }, 2000);
      } else {
        // Low confidence or failed - show failed state
        setStep('failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStep('failed');
    } finally {
      setIsVerifying(false);
    }
  };



  const handleClose = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setStep('ready');
    setIsVerifying(false);
    setPopupWindow(null);
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
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
    };
  }, [popupWindow]);

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
                      Now verify your {actionType} to earn your USDC reward
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
                  <strong>🔍 For Better Verification:</strong>
                </p>
                <p className="text-sm text-blue-200 mb-2">
                  Install our verification helper to automatically detect completed actions
                </p>
                <Button
                  onClick={() => window.open('/install-verification.html', '_blank')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm py-2"
                >
                  Install Verification Helper
                </Button>
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