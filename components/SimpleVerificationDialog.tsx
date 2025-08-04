'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Twitter } from 'lucide-react';

interface SimpleVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  actionType: 'like' | 'retweet' | 'comment';
  pricePerAction: string;
}

export function SimpleVerificationDialog({
  isOpen,
  onClose,
  onVerified,
  actionType,
  pricePerAction
}: SimpleVerificationDialogProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [step, setStep] = useState<'verify' | 'verified'>('verify');

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    comment: '💬'
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
    setStep('verify');
    setShowConfetti(false);
    setIsVerifying(false);
    onClose();
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
            Verify Action Completion
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'verify' && (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">{actionEmojis[actionType]}</div>
              
              <div>
                <p className="font-medium text-white text-lg">Did you complete the {actionType}?</p>
                <p className="text-sm text-slate-400 mt-2">
                  Confirm that you successfully completed the Twitter action
                </p>
              </div>

              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-sm text-green-300">
                  💰 Earn ${parseFloat(pricePerAction).toFixed(3)} USDC for completing this action
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
                    You earned ${parseFloat(pricePerAction).toFixed(3)} USDC! 💰
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