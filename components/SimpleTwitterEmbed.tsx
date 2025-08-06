'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Twitter } from 'lucide-react';
import { widgetVerifier } from '@/lib/widget-verification';

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

  // Initialize verification session on mount
  useEffect(() => {
    const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
    const vId = widgetVerifier.startVerification(normalizedActionType, tweetUrl);
    setVerificationId(vId);
    onVerificationReady?.(vId);
  }, [tweetUrl, actionType, onVerificationReady]);

  const handleOpenTwitter = () => {
    // Open Twitter in a new tab
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmInteraction = () => {
    if (verificationId) {
      // Record the interaction in the verification system
      const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
      widgetVerifier.recordInteraction(verificationId, normalizedActionType);
      
      // Extract tweet ID for history recording
      const tweetId = extractTweetId(tweetUrl);
      if (tweetId) {
        widgetVerifier.recordInteractionHistory(tweetId, normalizedActionType);
      }
    }
    
    setInteractionCompleted(true);
    onInteraction?.(actionType);
    
    // Show simple feedback
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

      {/* Action Buttons */}
      <div className="space-y-3">
        {!interactionCompleted ? (
          <>
            <Button
              onClick={handleOpenTwitter}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Twitter & {actionLabels[actionType]}
            </Button>
            
            <Button
              onClick={handleConfirmInteraction}
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              ✓ I completed the {actionType}
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-green-400 text-lg mb-2">
              ✅ Action Completed!
            </div>
            <p className="text-slate-400 text-sm">
              Your {actionType} has been recorded
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