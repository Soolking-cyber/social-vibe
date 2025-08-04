'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [step, setStep] = useState<'ready' | 'completing' | 'completed' | 'verified'>('ready');
  const [progress, setProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const progressRef = useRef<NodeJS.Timeout | null>(null);

  const startCompletion = () => {
    setStep('completing');
    setProgress(0);

    // Simulate automatic completion with progress
    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (progressRef.current) {
            clearInterval(progressRef.current);
          }
          setStep('completed');
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  const handleVerify = async () => {
    setStep('verified');
    setShowConfetti(true);

    // Call the verification callback after showing confetti
    setTimeout(() => {
      onVerified();
    }, 2000);
  };

  const handleClose = () => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
    }
    setStep('ready');
    setProgress(0);
    setShowConfetti(false);
    onClose();
  };

  useEffect(() => {
    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
      }
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
                  Click below to automatically complete this action and earn your reward!
                </p>
              </div>

              <Button onClick={startCompletion} className="w-full bg-blue-600 hover:bg-blue-700 py-3">
                <Twitter className="h-5 w-5 mr-2" />
                Complete {actionType} & Earn USDC
              </Button>
            </div>
          )}

          {step === 'completing' && (
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="animate-spin">
                  <Twitter className="h-16 w-16 mx-auto text-blue-500" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border-4 border-blue-500/20 rounded-full animate-ping"></div>
                </div>
              </div>

              <div>
                <p className="font-medium text-white text-lg">Completing {actionType}...</p>
                <p className="text-sm text-slate-400 mt-2">
                  Processing your Twitter action automatically
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-full bg-slate-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-400">{progress}% complete</p>
              </div>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center space-y-4">
              <div className="relative">
                <CheckCircle className="h-20 w-20 mx-auto text-green-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 border-4 border-green-500/30 rounded-full animate-ping"></div>
                </div>
              </div>

              <div>
                <p className="font-bold text-green-400 text-xl">Action Completed!</p>
                <p className="text-sm text-slate-400 mt-2">
                  Your {actionType} has been successfully processed
                </p>
              </div>

              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-sm text-green-300">
                  ✅ Ready to verify and claim your USDC reward
                </p>
              </div>

              <Button onClick={handleVerify} className="w-full bg-green-600 hover:bg-green-700 py-3">
                <CheckCircle className="h-5 w-5 mr-2" />
                Verify & Claim Reward
              </Button>
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