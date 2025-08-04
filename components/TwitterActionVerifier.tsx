'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Twitter, Sparkles } from 'lucide-react';

interface TwitterActionVerifierProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'comment';
  commentText?: string;
}

export function TwitterActionVerifier({
  isOpen,
  onClose,
  onVerified,
  tweetUrl,
  actionType,
  commentText
}: TwitterActionVerifierProps) {
  const [step, setStep] = useState<'ready' | 'action' | 'verify' | 'verified'>('ready');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);

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

  const openTwitterAction = () => {
    const url = getActionUrl();

    // Open Twitter in a small, centered popup window
    const popup = window.open(
      url,
      'twitter-action',
      'width=500,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no,left=' +
      (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
    );

    if (popup) {
      setPopupWindow(popup);
      setStep('action');

      // Monitor popup for closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setStep('verify');
        }
      }, 1000);
    } else {
      // Fallback if popup is blocked
      window.open(url, '_blank');
      setStep('action');
    }
  };

  const handleActionCompleted = () => {
    setStep('verify');
  };

  const handleVerify = async () => {
    setIsVerifying(true);

    // Simulate verification process
    await new Promise(resolve => setTimeout(resolve, 1500));

    setStep('verified');
    setShowConfetti(true);
    setIsVerifying(false);

    // Call the verification callback after showing confetti
    setTimeout(() => {
      onVerified();
    }, 2000);
  };

  const handleClose = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setStep('ready');
    setShowConfetti(false);
    setIsVerifying(false);
    setPopupWindow(null);
    onClose();
  };

  useEffect(() => {
    return () => {
      // Cleanup if needed
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

  // Confetti component
  const Confetti = () => (
    <div className="fixed inset-0 pointer-events-none z-50">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`
          }}
        >
          {['🎉', '✨', '🎊', '⭐', '💫'][Math.floor(Math.random() * 5)]}
        </div>
      ))}
    </div>
  );

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
                  onClick={handleActionCompleted}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I completed the action
                </Button>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="text-center space-y-4">
              <div className="relative">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border-4 border-green-500/30 rounded-full animate-ping"></div>
                </div>
              </div>

              <div>
                <p className="font-medium text-white text-lg">Ready to verify completion</p>
                <p className="text-sm text-slate-400 mt-2">
                  Did you successfully complete the {actionType} action?
                </p>
              </div>

              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-sm text-green-300">
                  ✅ Click verify to claim your USDC reward
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep('action')}
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  No, try again
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isVerifying ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying...
                    </div>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Yes, verify & earn
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'verified' && (
            <>
              {showConfetti && <Confetti />}
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}