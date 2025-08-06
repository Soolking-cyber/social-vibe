'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Twitter, Eye } from 'lucide-react';
import { widgetVerifier } from '@/lib/widget-verification';
import { nitterVerifier } from '@/lib/nitter-verification';

interface SimpleTwitterEmbedProps {
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'reply' | 'comment';
  onInteraction?: (type: 'like' | 'retweet' | 'reply' | 'comment') => void;
  onVerificationReady?: (verificationId: string) => void;
}

export function SimpleTwitterEmbed({ 
  tweetUrl, 
  actionType, 
  onInteraction, 
  onVerificationReady 
}: SimpleTwitterEmbedProps) {
  const [interactionCompleted, setInteractionCompleted] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [nitterVerificationId, setNitterVerificationId] = useState<string | null>(null);
  const [isInitializingNitter, setIsInitializingNitter] = useState(false);
  const [nitterError, setNitterError] = useState<string | null>(null);
  const [userTwitterHandle, setUserTwitterHandle] = useState<string>('');

  // Initialize verification session on mount
  useEffect(() => {
    const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
    const vId = widgetVerifier.startVerification(normalizedActionType, tweetUrl);
    setVerificationId(vId);
    onVerificationReady?.(vId);
  }, [tweetUrl, actionType, onVerificationReady]);

  const handleOpenTwitter = async () => {
    // For like actions, initialize Nitter verification
    if (actionType === 'like' && userTwitterHandle) {
      setIsInitializingNitter(true);
      setNitterError(null);
      
      try {
        const nitterId = await nitterVerifier.startLikeVerification(tweetUrl, userTwitterHandle);
        setNitterVerificationId(nitterId);
        console.log('✓ Nitter verification initialized - like count captured');
      } catch (error) {
        console.error('Failed to initialize Nitter verification:', error);
        setNitterError('Failed to initialize verification. Proceeding with manual verification.');
      } finally {
        setIsInitializingNitter(false);
      }
    }
    
    // Open Twitter in a new tab
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmInteraction = async () => {
    // For like actions with Nitter verification, verify the like count
    if (actionType === 'like' && nitterVerificationId) {
      try {
        const nitterResult = await nitterVerifier.verifyLikeCompletion(nitterVerificationId);
        
        if (nitterResult.success) {
          console.log('✓ Nitter verification successful:', nitterResult.details);
          
          // Record in widget verifier as well
          if (verificationId) {
            const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
            widgetVerifier.recordInteraction(verificationId, normalizedActionType);
            
            const tweetId = extractTweetId(tweetUrl);
            if (tweetId) {
              widgetVerifier.recordInteractionHistory(tweetId, normalizedActionType);
            }
          }
          
          setInteractionCompleted(true);
          onInteraction?.(actionType);
          return;
        } else {
          console.warn('Nitter verification failed:', nitterResult.details);
          setNitterError(`Verification failed: ${nitterResult.details}`);
          return;
        }
      } catch (error) {
        console.error('Nitter verification error:', error);
        setNitterError('Verification error. Please try again.');
        return;
      }
    }
    
    // Fallback to regular verification for non-like actions or when Nitter fails
    if (verificationId) {
      const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
      widgetVerifier.recordInteraction(verificationId, normalizedActionType);
      
      const tweetId = extractTweetId(tweetUrl);
      if (tweetId) {
        widgetVerifier.recordInteractionHistory(tweetId, normalizedActionType);
      }
    }
    
    setInteractionCompleted(true);
    onInteraction?.(actionType);
    
    console.log(`✓ ${actionType} interaction confirmed`);
  };

  // Extract tweet ID from URL
  const extractTweetId = (url: string): string | null => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  };

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    reply: '💬',
    comment: '💬'
  };

  const actionLabels = {
    like: 'Like',
    retweet: 'Retweet', 
    reply: 'Reply',
    comment: 'Comment'
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Simple Tweet Preview */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Twitter className="h-5 w-5 text-blue-400" />
          <span className="text-slate-300 text-sm">Twitter Action Required</span>
        </div>
        
        <div className="text-center py-6">
          <div className="text-4xl mb-2">{actionEmojis[actionType]}</div>
          <p className="text-white font-medium mb-2">
            {actionLabels[actionType]} this Tweet
          </p>
          <p className="text-slate-400 text-sm">
            Click below to open Twitter and complete the action
          </p>
        </div>
      </div>

      {/* Twitter Handle Input for Like Verification */}
      {actionType === 'like' && !interactionCompleted && (
        <div className="mb-4">
          <label className="block text-slate-300 text-sm font-medium mb-2">
            Your Twitter Handle (for verification)
          </label>
          <input
            type="text"
            placeholder="@username"
            value={userTwitterHandle}
            onChange={(e) => setUserTwitterHandle(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <p className="text-slate-500 text-xs mt-1">
            We'll verify your like by checking your profile on Nitter (no API costs)
          </p>
        </div>
      )}

      {/* Nitter Status */}
      {actionType === 'like' && nitterVerificationId && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2 text-green-300">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">
              ✓ Like count captured - ready for verification
            </span>
          </div>
        </div>
      )}

      {/* Nitter Error */}
      {nitterError && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-300 text-sm">
            ⚠️ {nitterError}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {!interactionCompleted ? (
          <>
            <Button
              onClick={handleOpenTwitter}
              disabled={actionType === 'like' && !userTwitterHandle.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {isInitializingNitter ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Capturing like count...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Twitter & {actionLabels[actionType]}
                </>
              )}
            </Button>
            
            <Button
              onClick={handleConfirmInteraction}
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {actionType === 'like' && nitterVerificationId ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Verify Like (Check Count)
                </>
              ) : (
                `✓ I completed the ${actionType}`
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-green-400 text-lg mb-2">
              ✅ Action Completed!
            </div>
            <p className="text-slate-400 text-sm">
              Your {actionType} has been verified
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-slate-800/30 border border-slate-700 rounded-lg">
        <p className="text-slate-400 text-xs">
          <strong>Instructions:</strong> Click "Open Twitter" to complete the {actionType} action, 
          then click "I completed" to verify and earn your reward.
        </p>
      </div>
    </div>
  );
}