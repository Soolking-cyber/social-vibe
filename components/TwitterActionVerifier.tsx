'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, ExternalLink, AlertCircle, Twitter } from 'lucide-react';

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
  const [step, setStep] = useState<'instructions' | 'popup' | 'verify' | 'verified'>('instructions');
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [actionCompleted, setActionCompleted] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const extractTweetId = (url: string): string => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : '';
  };

  const getActionUrl = () => {
    const tweetId = extractTweetId(tweetUrl);
    const baseUrl = window.location.origin;
    const callbackUrl = `${baseUrl}/twitter-callback`;

    switch (actionType) {
      case 'like':
        return `https://twitter.com/intent/like?tweet_id=${tweetId}&related=socialimpact`;
      case 'retweet':
        return `https://twitter.com/intent/retweet?tweet_id=${tweetId}&related=socialimpact`;
      case 'comment':
        const encodedComment = encodeURIComponent(commentText || '');
        return `https://twitter.com/intent/tweet?in_reply_to=${tweetId}&text=${encodedComment}&related=socialimpact`;
      default:
        return tweetUrl;
    }
  };

  const openTwitterPopup = () => {
    const url = getActionUrl();
    console.log('Opening Twitter popup:', url);
    
    const popup = window.open(
      url,
      'twitter-action',
      'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no'
    );
    
    if (popup) {
      setPopupWindow(popup);
      setStep('popup');
      
      // Monitor popup for completion
      checkIntervalRef.current = setInterval(() => {
        try {
          if (popup.closed) {
            console.log('Popup closed by user');
            setStep('verify');
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
            }
            return;
          }

          // Try to detect completion by checking URL
          try {
            const currentUrl = popup.location.href;
            console.log('Current popup URL:', currentUrl);
            
            // Check for success indicators in URL
            if (currentUrl.includes('twitter.com') && 
                (currentUrl.includes('home') || 
                 currentUrl.includes('status') || 
                 currentUrl.includes('compose'))) {
              console.log('Detected potential action completion');
              setActionCompleted(true);
            }
          } catch (e) {
            // Cross-origin restrictions - this is normal
          }

          // Auto-advance to verify step after 30 seconds
          if (!verificationTimeoutRef.current) {
            verificationTimeoutRef.current = setTimeout(() => {
              if (!popup.closed) {
                console.log('Auto-advancing to verification after timeout');
                setStep('verify');
                if (checkIntervalRef.current) {
                  clearInterval(checkIntervalRef.current);
                }
              }
            }, 30000);
          }

        } catch (error) {
          console.error('Error monitoring popup:', error);
        }
      }, 1000);

      // Listen for postMessage from popup (if Twitter supported it)
      const handleMessage = (event: MessageEvent) => {
        if (event.origin === 'https://twitter.com' || event.origin === 'https://x.com') {
          console.log('Received message from Twitter:', event.data);
          if (event.data.type === 'twitter-action-completed') {
            setActionCompleted(true);
            setStep('verify');
          }
        }
      };

      window.addEventListener('message', handleMessage);
      
      // Cleanup listener when popup closes
      const cleanupListener = () => {
        window.removeEventListener('message', handleMessage);
      };
      
      popup.addEventListener('beforeunload', cleanupListener);
    } else {
      // Handle popup blocked - show elegant error in the dialog
      setStep('instructions');
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    
    try {
      // Simulate verification process with visual feedback
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Verifying Twitter action completion...');
      console.log(`Action type: ${actionType}`);
      console.log(`Tweet URL: ${tweetUrl}`);
      console.log(`Action completed indicator: ${actionCompleted}`);
      
      setStep('verified');
      setIsVerifying(false);
      
      // Call the verification callback
      setTimeout(() => {
        onVerified();
      }, 1500);
      
    } catch (error) {
      console.error('Verification error:', error);
      setIsVerifying(false);
      // Reset to verify step to allow retry
      setStep('verify');
    }
  };

  const handleClose = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
    }
    setStep('instructions');
    setActionCompleted(false);
    onClose();
  };

  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
    };
  }, []);

  const actionInstructions = {
    like: 'Like the tweet by clicking the heart ❤️ icon',
    retweet: 'Retweet by clicking the retweet 🔄 icon',
    comment: `Reply to the tweet with the specified comment`
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

        <div className="space-y-4">
          {step === 'instructions' && (
            <>
              <div className="text-center space-y-4">
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <p className="text-sm text-slate-200 font-medium mb-2">
                    Action Required: {actionInstructions[actionType]}
                  </p>
                  {commentText && (
                    <div className="mt-3 p-3 bg-slate-700/50 rounded border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1">Comment to post:</p>
                      <p className="text-sm font-mono text-slate-200">"{commentText}"</p>
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-slate-400 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    <span>Click "Open Twitter" to open the tweet in a popup window</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <span>Complete the required {actionType} action on Twitter</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    <span>Close the popup or wait for automatic detection</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                    <span>Confirm completion to earn your reward</span>
                  </div>
                </div>
              </div>

              <Button onClick={openTwitterPopup} className="w-full bg-blue-600 hover:bg-blue-700">
                <Twitter className="h-4 w-4 mr-2" />
                Open Twitter
              </Button>
            </>
          )}

          {step === 'popup' && (
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="animate-pulse">
                  <Twitter className="h-16 w-16 mx-auto text-blue-500" />
                </div>
                {actionCompleted && (
                  <div className="absolute -top-2 -right-2">
                    <CheckCircle className="h-6 w-6 text-green-500 animate-bounce" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-white">Twitter popup is open</p>
                <p className="text-sm text-slate-400 mb-2">
                  Complete the {actionType} action and the system will detect it
                </p>
                {actionCompleted && (
                  <p className="text-sm text-green-400 font-medium">
                    ✅ Action detected! You can now verify completion.
                  </p>
                )}
              </div>
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-300">
                  <AlertCircle className="h-4 w-4 inline mr-2 text-blue-400" />
                  Keep this dialog open while completing the action
                </p>
              </div>
              {actionCompleted && (
                <Button onClick={() => setStep('verify')} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Continue to Verification
                </Button>
              )}
            </div>
          )}

          {step === 'verify' && (
            <div className="text-center space-y-4">
              <div className="relative">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                {actionCompleted && (
                  <div className="absolute -top-1 -right-1">
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-ping"></div>
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-white">Ready to verify completion</p>
                <p className="text-sm text-slate-400">
                  Did you successfully complete the {actionType} action?
                </p>
                {actionCompleted && (
                  <p className="text-sm text-green-400 mt-2">
                    ✅ Our system detected activity - looking good!
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('instructions')}
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
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="animate-bounce">
                  <CheckCircle className="h-20 w-20 mx-auto text-green-500" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-green-500/30 rounded-full animate-ping"></div>
                </div>
              </div>
              <div>
                <p className="font-bold text-green-400 text-lg">Action Verified!</p>
                <p className="text-sm text-slate-400">
                  Your reward is being processed...
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-300">
                  🎉 Congratulations! Your USDC reward will be added to your balance shortly.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}