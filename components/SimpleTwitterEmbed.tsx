'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Twitter, Eye } from 'lucide-react';
import { twitterAPIIOVerifier } from '@/lib/twitterapi-io-verification';
import { useSession } from 'next-auth/react';

interface SimpleTwitterEmbedProps {
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'reply' | 'comment';
  onInteraction?: (type: 'like' | 'retweet' | 'reply' | 'comment') => void;
}

export function SimpleTwitterEmbed({
  tweetUrl,
  actionType,
  onInteraction
}: SimpleTwitterEmbedProps) {
  const [mounted, setMounted] = useState(false);
  const [interactionCompleted, setInteractionCompleted] = useState(false);

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isInitializingVerification, setIsInitializingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>('');
  const [userTwitterHandle, setUserTwitterHandle] = useState<string>('');
  const [isLoadingHandle, setIsLoadingHandle] = useState(true);
  const [twitterOpenedAt, setTwitterOpenedAt] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const { data: session } = useSession();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's Twitter handle from database
  useEffect(() => {
    const fetchTwitterHandle = async () => {
      console.log('🔍 Session data:', session);

      if (!session?.user) {
        console.warn('⚠️ No session or user found');
        setIsLoadingHandle(false);
        return;
      }

      // FIRST: Try to get from session directly (if available)
      const sessionHandle = (session.user as any).twitterHandle;
      if (sessionHandle) {
        console.log('✅ Found Twitter handle in session:', sessionHandle);
        setUserTwitterHandle(sessionHandle);
        setIsLoadingHandle(false);
        return;
      }

      // SECOND: Try to extract from session name (common pattern)
      if (session.user.name && session.user.name.startsWith('@')) {
        const handleFromName = session.user.name.replace('@', '');
        console.log('✅ Extracted Twitter handle from session name:', handleFromName);
        setUserTwitterHandle(handleFromName);
        setIsLoadingHandle(false);
        return;
      }

      // THIRD: Try API call to database
      try {
        console.log('🔍 Fetching Twitter handle from API...');
        const response = await fetch('/api/user/twitter-handle');
        console.log('📡 API response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('📊 API response data:', data);

          if (data.twitterHandle) {
            setUserTwitterHandle(data.twitterHandle);
            console.log('✅ Twitter handle set from API:', data.twitterHandle);
          } else {
            console.warn('⚠️ No Twitter handle in API response:', data);
          }
        } else {
          const errorData = await response.text();
          console.error('❌ API response not ok:', response.status, errorData);
        }
      } catch (error) {
        console.error('❌ Failed to fetch Twitter handle:', error);
      } finally {
        setIsLoadingHandle(false);
      }
    };

    if (mounted && session) {
      fetchTwitterHandle();
    }
  }, [mounted, session]);

  // Reset verification when key props change
  useEffect(() => {
    setInteractionCompleted(false);
    setVerificationId(null);
    setVerificationError(null);
    setVerificationStatus('');
  }, [tweetUrl, actionType]);

  // Timer for countdown
  useEffect(() => {
    if (!twitterOpenedAt) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - twitterOpenedAt;
      const remaining = Math.max(0, Math.ceil((10000 - elapsed) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [twitterOpenedAt]);

  const handleOpenTwitter = async () => {
    // Automatically initialize TwitterAPI.io verification if Twitter handle is available
    if (userTwitterHandle.trim() && typeof window !== 'undefined') {
      setIsInitializingVerification(true);
      setVerificationError(null);
      setVerificationStatus('Initializing TwitterAPI.io verification...');

      try {
        const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
        const hybridActionType = normalizedActionType as 'like' | 'retweet' | 'reply';

        const verificationId = await twitterAPIIOVerifier.startVerification(tweetUrl, userTwitterHandle, hybridActionType);
        setVerificationId(verificationId);

        setVerificationStatus(`✓ TwitterAPI.io verification initialized for @${userTwitterHandle}`);
        console.log(`✓ TwitterAPI.io verification initialized for @${userTwitterHandle} - ${actionType} count captured`);
      } catch (error) {
        console.error('Failed to initialize verification:', error);
        setVerificationError('Failed to initialize verification. Please try again or contact support.');
        setVerificationStatus('');
      } finally {
        setIsInitializingVerification(false);
      }
    }

    // Open Twitter in a new tab (client-side only)
    if (typeof window !== 'undefined') {
      window.open(tweetUrl, '_blank', 'noopener,noreferrer');
      setTwitterOpenedAt(Date.now());
    }
  };

  const handleConfirmInteraction = async () => {
    // Normalize action type once at the beginning
    const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;

    console.log('🔍 VERIFICATION ATTEMPT:', {
      userTwitterHandle,
      verificationId,
      actionType: normalizedActionType
    });

    // SECURITY: NO VERIFICATION WITHOUT TWITTER HANDLE - PERIOD!
    if (!userTwitterHandle) {
      console.error('❌ SECURITY BLOCK: No Twitter handle');
      setVerificationError('🔒 Twitter handle required for verification. Please log out and log back in with Twitter to set up your handle.');
      return;
    }

    // SECURITY: NO VERIFICATION WITHOUT VERIFICATION INITIALIZATION - PERIOD!
    if (!verificationId) {
      console.error('❌ SECURITY BLOCK: No verification ID');
      setVerificationError('🔒 Please click "Open Twitter" first to initialize verification before confirming.');
      return;
    }

    // SECURITY: REQUIRE MINIMUM TIME DELAY (prevent instant verification)
    const MIN_ACTION_TIME = 10000; // 10 seconds minimum
    if (twitterOpenedAt && (Date.now() - twitterOpenedAt) < MIN_ACTION_TIME) {
      const remainingTime = Math.ceil((MIN_ACTION_TIME - (Date.now() - twitterOpenedAt)) / 1000);
      console.error('❌ SECURITY BLOCK: Too fast verification attempt');
      setVerificationError(`🔒 Please wait ${remainingTime} more seconds before verifying. This ensures you had time to complete the action.`);
      return;
    }

    // Add loading state
    setVerificationError('🔍 Verifying your action...');

    // USE TWITTERAPI.IO VERIFICATION SYSTEM
    try {
      console.log(`🔍 Starting TwitterAPI.io verification for ID:`, verificationId);
      const result = await twitterAPIIOVerifier.verifyCompletion(verificationId);

      console.log('🔍 TwitterAPI.io verification result:', result);

      if (result.success) {
        console.log('✅ VERIFICATION SUCCESS:', result.details);

        setVerificationError(null);
        setVerificationStatus(`✅ Verified via TwitterAPI.io`);
        setInteractionCompleted(true);
        onInteraction?.(actionType);
        return;
      } else {
        console.error('❌ VERIFICATION FAILED:', result);
        setVerificationError(`🔒 Verification failed: ${result.details}. You must actually complete the ${actionType} action on Twitter.`);
        setVerificationStatus('');
        return;
      }
    } catch (error) {
      console.error('❌ VERIFICATION ERROR:', error);
      setVerificationError('🔒 Verification error. Please try again or contact support.');
      setVerificationStatus('');
      return;
    }
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

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
          <div className="animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Twitter Handle Status */}
      {!interactionCompleted && (
        <div className="mb-4">
          {isLoadingHandle ? (
            <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <span className="text-slate-300 text-sm">Loading your Twitter handle...</span>
              </div>
            </div>
          ) : userTwitterHandle ? (
            <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-300">
                <Twitter className="h-4 w-4" />
                <span className="text-sm font-medium">
                  ✓ Using your Twitter handle: @{userTwitterHandle}
                </span>
              </div>
              <p className="text-green-200 text-xs mt-1">
                We'll verify your {actionType} using TwitterAPI.io (reliable, professional API)
              </p>
            </div>
          ) : (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-300">
                <Twitter className="h-4 w-4" />
                <span className="text-sm font-medium">
                  🔒 Twitter handle required for verification
                </span>
              </div>
              <p className="text-red-200 text-xs mt-1">
                <strong>QUICK FIX:</strong> Enter your Twitter handle manually:
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="@username"
                  className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                  onChange={(e) => {
                    const handle = e.target.value.replace('@', '');
                    if (handle) {
                      setUserTwitterHandle(handle);
                    }
                  }}
                />
                <button
                  onClick={() => window.location.reload()}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verification Status */}
      {verificationStatus && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2 text-green-300">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">
              {verificationStatus}
            </span>
          </div>
          <p className="text-green-200 text-xs mt-1">
            Method: TwitterAPI.io (reliable, professional API)
          </p>
        </div>
      )}

      {/* Verification Error */}
      {verificationError && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-300 text-sm">
            ⚠️ {verificationError}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {!interactionCompleted ? (
          <>
            <Button
              onClick={handleOpenTwitter}
              disabled={isLoadingHandle}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {isLoadingHandle ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : isInitializingVerification ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Initializing verification...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Twitter & {actionLabels[actionType]}
                  {userTwitterHandle && ' (Auto-verify)'}
                </>
              )}
            </Button>

            <Button
              onClick={handleConfirmInteraction}
              variant="outline"
              disabled={!userTwitterHandle || !verificationId || timeRemaining > 0}
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {!userTwitterHandle ? (
                <>
                  🔒 Twitter handle required for verification
                </>
              ) : !verificationId ? (
                <>
                  🔒 Click "Open Twitter" first to verify
                </>
              ) : timeRemaining > 0 ? (
                <>
                  ⏳ Wait {timeRemaining}s to verify
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Verify {actionLabels[actionType]} (TwitterAPI.io)
                </>
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
        <div>
          <p className="text-slate-400 text-xs">
            <strong>🔒 TwitterAPI.io Verification Process:</strong>
          </p>
          <ol className="text-slate-400 text-xs mt-1 space-y-1">
            <li>1. Twitter handle must be detected from your login</li>
            <li>2. Click "Open Twitter" to initialize TwitterAPI.io verification</li>
            <li>3. Complete the {actionType} action on Twitter</li>
            <li>4. Return and click "Verify" to confirm the count increased</li>
          </ol>
          <p className="text-blue-300 text-xs mt-2">
            💡 <strong>Professional API:</strong> Uses TwitterAPI.io for reliable, accurate verification
          </p>
        </div>
      </div>
    </div>
  );
}