'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Twitter, AlertTriangle } from 'lucide-react';
import { browserVerifier, VerificationResult } from '@/lib/browser-verification';

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
  const [step, setStep] = useState<'verify' | 'verified' | 'failed'>('verify');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    comment: '💬'
  };

  const handleVerify = async (userConfirmed: boolean = true) => {
    setIsVerifying(true);

    try {
      // For simple dialog, we'll use manual verification since we don't have
      // the full verification flow setup
      const verificationId = `simple_${Date.now()}`;
      const result = await browserVerifier.manualVerification(verificationId, userConfirmed);
      setVerificationResult(result);

      if (result.success) {
        setStep('verified');
        setTimeout(() => {
          onVerified();
        }, 1500);
      } else {
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
    setStep('verify');
    setIsVerifying(false);
    setVerificationResult(null);
    onClose();
  };



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
                  onClick={() => handleVerify(true)}
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
                  <strong>Please ensure you:</strong>
                </p>
                <p className="text-sm text-slate-400">
                  1. Actually completed the {actionType} action on Twitter
                </p>
                <p className="text-sm text-slate-400">
                  2. Only claim rewards for actions you genuinely performed
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
                  onClick={() => setStep('verify')}
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