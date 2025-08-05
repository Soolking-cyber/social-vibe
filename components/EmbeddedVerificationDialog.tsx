'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Twitter, AlertTriangle } from 'lucide-react';
import { SimpleTwitterEmbed } from './SimpleTwitterEmbed';
import { SimpleErrorBoundary } from './SimpleErrorBoundary';
import { widgetVerifier } from '@/lib/widget-verification';
import { WidgetVerificationStatus } from './WidgetVerificationStatus';
import { ErrorBoundary } from './ErrorBoundary';

interface EmbeddedVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  job: {
    id: string;
    actionType: 'like' | 'retweet' | 'comment';
    targetUrl: string;
    reward: string;
  };
}

export function EmbeddedVerificationDialog({
  isOpen,
  onClose,
  onVerified,
  job
}: EmbeddedVerificationDialogProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [interactionDetected, setInteractionDetected] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [step, setStep] = useState<'interact' | 'verified' | 'failed'>('interact');

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    comment: '💬'
  };

  const handleVerify = async () => {
    if (!verificationId) return;

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // Use widget verification system
      const result = await widgetVerifier.verifyCompletion(
        verificationId,
        true // User confirmed they completed the action
      );

      if (result.success) {
        // Call the existing jobs completion API
        const response = await fetch('/api/jobs/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: job.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          setVerificationResult(`You earned ${data.rewardAmount} USDC!`);
          setStep('verified');

          // Close dialog after success
          setTimeout(() => {
            onVerified();
            onClose();
          }, 3000);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to process verification');
        }
      } else {
        setVerificationResult(`Verification failed: ${result.details}`);
        setStep('failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult('Verification failed. Please try again.');
      setStep('failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setStep('interact');
    setIsVerifying(false);
    setVerificationResult(null);
    setInteractionDetected(false);
    setVerificationId(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Twitter className="h-5 w-5 text-blue-500" />
            {actionEmojis[job.actionType]} {job.actionType.charAt(0).toUpperCase() + job.actionType.slice(1)} this Tweet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'interact' && (
            <>
              {/* Verification Status */}
              <WidgetVerificationStatus
                verificationId={verificationId}
                interactionDetected={interactionDetected}
                className="mb-4"
              />

              {/* Embedded Twitter Widget */}
              <div className="mb-6">
                <SimpleErrorBoundary>
                  <SimpleTwitterEmbed
                    tweetUrl={job.targetUrl}
                    actionType={job.actionType}
                    onInteraction={(type) => {
                      console.log(`User interacted: ${type}`);
                      setInteractionDetected(true);
                    }}
                    onVerificationReady={(vId) => {
                      setVerificationId(vId);
                    }}
                  />
                </SimpleErrorBoundary>
              </div>

              {/* Reward Info */}
              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-green-300 text-sm text-center">
                  💰 <strong>Earn {job.reward} USDC</strong> for completing this {job.actionType} action!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  disabled={isVerifying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={isVerifying || !verificationId}
                  className={`flex-1 font-medium transition-colors ${interactionDetected
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-800'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800'
                    } disabled:opacity-50 text-white`}
                >
                  {isVerifying ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Verifying...
                    </div>
                  ) : interactionDetected ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      🎉 Verify & Earn USDC
                    </>
                  ) : (
                    `✓ I completed the ${job.actionType}`
                  )}
                </Button>
              </div>

              {/* Instructions */}
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-slate-300 text-sm">
                  <strong>How it works:</strong>
                </p>
                <ol className="text-slate-400 text-sm mt-2 space-y-1">
                  <li>1. {job.actionType.charAt(0).toUpperCase() + job.actionType.slice(1)} the tweet above using the embedded widget</li>
                  <li>2. Click "Verify & Earn USDC" to confirm your action</li>
                  <li>3. Receive your {job.reward} USDC reward instantly!</li>
                </ol>
              </div>
            </>
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
                  {verificationResult} 💰
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
                  We couldn't verify that you completed the {job.actionType} action
                </p>
              </div>

              {verificationResult && (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-300">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    {verificationResult}
                  </p>
                </div>
              )}

              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-sm text-slate-300 mb-2">
                  <strong>Please ensure you:</strong>
                </p>
                <p className="text-sm text-slate-400">
                  1. Actually {job.actionType} the tweet using the widget above
                </p>
                <p className="text-sm text-slate-400">
                  2. Wait for the interaction to be detected (green checkmark)
                </p>
                <p className="text-sm text-slate-400">
                  3. Only claim rewards for actions you genuinely performed
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
                  onClick={() => setStep('interact')}
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