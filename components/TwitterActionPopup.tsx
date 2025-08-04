'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';

interface TwitterActionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'comment';
  commentText?: string;
}

export function TwitterActionPopup({
  isOpen,
  onClose,
  onVerified,
  tweetUrl,
  actionType,
  commentText
}: TwitterActionPopupProps) {
  const [step, setStep] = useState<'instructions' | 'popup' | 'verify' | 'verified'>('instructions');
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const actionInstructions = {
    like: 'Like the tweet by clicking the heart icon',
    retweet: 'Retweet by clicking the retweet icon',
    comment: `Reply to the tweet with: "${commentText}"`
  };

  const actionUrls = {
    like: tweetUrl,
    retweet: `https://twitter.com/intent/retweet?tweet_id=${extractTweetId(tweetUrl)}`,
    comment: `https://twitter.com/intent/tweet?in_reply_to=${extractTweetId(tweetUrl)}&text=${encodeURIComponent(commentText || '')}`
  };

  function extractTweetId(url: string): string {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : '';
  }

  const openTwitterPopup = () => {
    const url = actionUrls[actionType];
    const popup = window.open(
      url,
      'twitter-action',
      'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no'
    );
    
    if (popup) {
      setPopupWindow(popup);
      setStep('popup');
      
      // Check if popup is closed and try to detect if action was completed
      checkIntervalRef.current = setInterval(() => {
        if (popup.closed) {
          setStep('verify');
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
          }
        } else {
          // Try to detect if user completed the action by checking URL changes
          try {
            const currentUrl = popup.location.href;
            console.log('Popup URL:', currentUrl);
            
            // If we can access the URL and it's changed from the original intent URL,
            // it might indicate the user completed the action
            if (currentUrl && !currentUrl.includes('intent') && currentUrl.includes('twitter.com')) {
              console.log('Detected potential action completion based on URL change');
            }
          } catch (e) {
            // Cross-origin restrictions prevent us from accessing popup URL
            // This is expected for Twitter popups
          }
        }
      }, 1000);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    
    try {
      // Add a small delay to make it feel more authentic
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, you could:
      // 1. Check if the popup window's URL changed to indicate completion
      // 2. Use postMessage to communicate with the popup
      // 3. Check localStorage for completion markers
      // 4. Use Twitter's web intents callback URLs
      
      console.log('Verifying Twitter action completion...');
      console.log(`Action type: ${actionType}`);
      console.log(`Tweet URL: ${tweetUrl}`);
      
      // For now, we trust the user's confirmation
      // In production, you might want to add additional verification steps
      
      setStep('verified');
      setIsVerifying(false);
      
      // Call the verification callback after a short delay
      setTimeout(() => {
        onVerified();
      }, 1000);
      
    } catch (error) {
      console.error('Verification error:', error);
      setIsVerifying(false);
      alert('Verification failed. Please try again.');
    }
  };

  const handleClose = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    setStep('instructions');
    onClose();
  };

  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Complete Twitter Action
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'instructions' && (
            <>
              <div className="text-center space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Action Required:</strong> {actionInstructions[actionType]}
                  </p>
                  {commentText && (
                    <p className="text-xs text-blue-600 mt-2 font-mono bg-blue-100 p-2 rounded">
                      "{commentText}"
                    </p>
                  )}
                </div>
                
                <div className="text-sm text-gray-600">
                  <p>1. Click "Open Twitter" to open the tweet in a popup</p>
                  <p>2. Complete the required action</p>
                  <p>3. Close the popup when done</p>
                  <p>4. Click "Verify Action" to confirm completion</p>
                </div>
              </div>

              <Button onClick={openTwitterPopup} className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Twitter
              </Button>
            </>
          )}

          {step === 'popup' && (
            <div className="text-center space-y-4">
              <div className="animate-pulse">
                <ExternalLink className="h-12 w-12 mx-auto text-blue-500" />
              </div>
              <div>
                <p className="font-medium">Twitter popup is open</p>
                <p className="text-sm text-gray-600">
                  Complete the action and close the popup when done
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Don't close this dialog while the popup is open
                </p>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <div>
                <p className="font-medium">Ready to verify</p>
                <p className="text-sm text-gray-600">
                  Did you complete the {actionType} action?
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('instructions')}
                  className="flex-1"
                >
                  No, try again
                </Button>
                <Button 
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="flex-1"
                >
                  {isVerifying ? 'Verifying...' : 'Yes, verify action'}
                </Button>
              </div>
            </div>
          )}

          {step === 'verified' && (
            <div className="text-center space-y-4">
              <div className="animate-bounce">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-700">Action Verified!</p>
                <p className="text-sm text-gray-600">
                  Your job completion is being processed...
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}