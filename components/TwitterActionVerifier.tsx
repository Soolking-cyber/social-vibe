'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Twitter, Sparkles, AlertTriangle, Clock } from 'lucide-react';
import { browserVerifier, VerificationResult } from '@/lib/browser-verification';

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
  const [step, setStep] = useState<'ready' | 'action' | 'verify' | 'verified' | 'failed'>('ready');
  const [isVerifying, setIsVerifying] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
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

  const openTwitterAction = async () => {
    const url = getActionUrl();

    // Start browser-based verification
    const verifyId = await browserVerifier.startVerification(
      actionType,
      tweetUrl,
      commentText
    );

    setVerificationId(verifyId);
    setStartTime(Date.now());

    // Try popup first, fallback to new tab
    const popup = window.open(
      url,
      'twitter-action',
      'width=500,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no,left=' +
      (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
    );

    if (popup) {
      setPopupWindow(popup);
      setStep('action');

      // Monitor popup for closure and try to detect completion
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setStep('verify');
        }
      }, 1000);
    } else {
      // Fallback: open in new tab (mobile/popup blocked)
      window.open(url, '_blank');
      setStep('action');
    }
  };

  const handleVerifyAction = () => {
    // Open Twitter again to check if the action was completed
    const tweetId = extractTweetId(tweetUrl);
    const verifyUrl = `https://twitter.com/status/${tweetId}`;
    
    // Open Twitter to verify the action
    const verifyPopup = window.open(
      verifyUrl,
      'twitter-verify',
      'width=500,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no,left=' +
      (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
    );

    if (verifyPopup) {
      setPopupWindow(verifyPopup);
      setStep('verify');

      // Monitor popup for closure and automatically verify
      const checkClosed = setInterval(() => {
        if (verifyPopup.closed) {
          clearInterval(checkClosed);
          // Automatically start verification process
          handleVerify();
        }
      }, 1000);
    } else {
      // Fallback: open in new tab and go to verify step
      window.open(verifyUrl, '_blank');
      setStep('verify');
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
      setVerificationResult(result);

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
        // Low confidence or failed - require manual confirmation
        setStep('verify');
        // Don't auto-proceed, let user manually confirm
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStep('failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualConfirmation = async (userConfirmed: boolean) => {
    if (!verificationId) return;

    setIsVerifying(true);

    try {
      // First get browser verification result
      const result = await browserVerifier.manualVerification(verificationId, userConfirmed);
      setVerificationResult(result);

      // If we have a jobId, perform server-side verification
      if (jobId && result.success) {
        const serverResponse = await fetch('/api/verify-action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
            verificationId,
            verificationResult: result,
            actionType,
            tweetUrl
          }),
        });

        const serverResult = await serverResponse.json();

        if (serverResult.success) {
          setStep('verified');
          setTimeout(() => {
            onVerified();
          }, 1500);
        } else {
          setVerificationResult({
            success: false,
            confidence: 'low',
            method: 'server_rejected',
            details: serverResult.message || 'Server verification failed'
          });
          setStep('failed');
        }
      } else if (result.success) {
        // No server verification needed, proceed with client result
        setStep('verified');
        setTimeout(() => {
          onVerified();
        }, 1500);
      } else {
        setStep('failed');
      }
    } catch (error) {
      console.error('Manual verification error:', error);
      setVerificationResult({
        success: false,
        confidence: 'low',
        method: 'error',
        details: 'Verification failed due to an error'
      });
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
    setTimeSpent(0);
    setStartTime(null);
    onClose();
  };

  // Timer effect to track time spent
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (startTime && (step === 'action' || step === 'verify')) {
      interval = setInterval(() => {
        setTimeSpent(Date.now() - startTime);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
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

              <Button onClick={openTwitterAction} className="w-full bg-blue-600 hover:bg-blue-700 py-3">
                <Twitter className="h-5 w-5 mr-2" />
                Open Twitter & {actionButtons[actionType]}
              </Button>
            </div>
          )}

          {step === 'action' && (
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="animate-pulse">
                  <Twitter className="h-20 w-20 mx-auto text-blue-500" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 border-4 border-blue-500/20 rounded-full animate-ping"></div>
                </div>
              </div>

              <div>
                <p className="font-medium text-white text-lg">Twitter popup opened!</p>
                <p className="text-sm text-slate-400 mt-2">
                  Complete the {actionType} action in the popup window
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-300">
                  📱 <strong>Instructions:</strong>
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  1. Click the "{actionButtons[actionType]}" button in the popup
                </p>
                <p className="text-sm text-slate-400">
                  2. Close the popup when done
                </p>
                <p className="text-sm text-slate-400">
                  3. Come back here to verify and earn your reward
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep('ready')}
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifyAction}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify Action
                </Button>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="animate-pulse">
                  <CheckCircle className="h-16 w-16 mx-auto text-blue-500" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-ping"></div>
                </div>
              </div>

              <div>
                <p className="font-medium text-white text-lg">Verifying your action...</p>
                <p className="text-sm text-slate-400 mt-2">
                  We opened Twitter to check if you completed the {actionType} action
                </p>
              </div>

              <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <p className="text-sm text-blue-300">
                  🔍 Close the Twitter tab when you're done to complete verification
                </p>
              </div>

              {/* Time spent indicator */}
              {timeSpent > 0 && (
                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="h-4 w-4" />
                    Time spent: {Math.round(timeSpent / 1000)}s
                    {timeSpent < 3000 && (
                      <span className="text-yellow-400 ml-2">
                        ⚠️ Minimum 3s required
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Verification result display */}
              {verificationResult && (
                <div className={`p-3 border rounded-lg ${verificationResult.success
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-red-900/20 border-red-700'
                  }`}>
                  <div className="flex items-center gap-2 text-sm">
                    {verificationResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    )}
                    <span className={verificationResult.success ? 'text-green-300' : 'text-red-300'}>
                      {verificationResult.confidence === 'high' ? '✅ High confidence' :
                        verificationResult.confidence === 'medium' ? '⚠️ Medium confidence' :
                          '❌ Low confidence'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {verificationResult.details}
                  </p>
                </div>
              )}

              {isVerifying && (
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying action completion...</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep('action')}
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  disabled={isVerifying}
                >
                  Try again
                </Button>
                
                {!isVerifying && (
                  <Button
                    onClick={() => handleManualConfirmation(true)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    I completed it
                  </Button>
                )}
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
                  We couldn't verify that you completed the {actionType} action
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

              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-300 mb-2">
                  <strong>To earn your reward:</strong>
                </p>
                <p className="text-sm text-slate-400">
                  1. Make sure you actually completed the {actionType} action
                </p>
                <p className="text-sm text-slate-400">
                  2. Spend at least 3 seconds on the Twitter page
                </p>
                <p className="text-sm text-slate-400">
                  3. Return to this page after completing the action
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