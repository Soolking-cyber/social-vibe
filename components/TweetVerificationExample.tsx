'use client';

import { useState } from 'react';
import { TweetCounts, VerificationResult, tweetVerification } from '@/lib/tweet-verification';

export default function TweetVerificationExample() {
  const [tweetId, setTweetId] = useState('');
  const [action, setAction] = useState<'like' | 'retweet' | 'reply'>('like');
  const [beforeCounts, setBeforeCounts] = useState<TweetCounts | null>(null);
  const [afterCounts, setAfterCounts] = useState<TweetCounts | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'before' | 'waiting' | 'after' | 'result'>('input');

  const handleGetBeforeCounts = async () => {
    if (!tweetId) {
      alert('Please enter a tweet ID');
      return;
    }

    setLoading(true);
    setStep('before');
    
    try {
      const result = await tweetVerification.getTweetCounts(tweetId);
      
      if (result.success && result.counts) {
        setBeforeCounts(result.counts);
        setStep('waiting');
      } else {
        alert(`Error: ${result.error}`);
        setStep('input');
      }
    } catch (error) {
      alert(`Error: ${error}`);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleGetAfterCounts = async () => {
    setLoading(true);
    setStep('after');
    
    try {
      const result = await tweetVerification.getTweetCounts(tweetId);
      
      if (result.success && result.counts) {
        setAfterCounts(result.counts);
        
        // Automatically verify
        if (beforeCounts) {
          const verifyResult = await tweetVerification.verifyAction(
            tweetId,
            action,
            beforeCounts,
            result.counts
          );
          setVerificationResult(verifyResult);
          setStep('result');
        }
      } else {
        alert(`Error: ${result.error}`);
        setStep('waiting');
      }
    } catch (error) {
      alert(`Error: ${error}`);
      setStep('waiting');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTweetId('');
    setBeforeCounts(null);
    setAfterCounts(null);
    setVerificationResult(null);
    setStep('input');
  };

  const handleQuickVerify = async () => {
    if (!tweetId) {
      alert('Please enter a tweet ID');
      return;
    }

    setLoading(true);
    setStep('before');
    
    try {
      const result = await tweetVerification.completeVerificationWorkflow(
        tweetId,
        action,
        (counts) => {
          setBeforeCounts(counts);
          setStep('waiting');
        },
        () => {
          // User should complete action now
        },
        15000 // 15 seconds wait
      );
      
      setVerificationResult(result);
      setStep('result');
    } catch (error) {
      alert(`Error: ${error}`);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Tweet Verification Example</h2>
      
      {/* Input Step */}
      {step === 'input' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tweet ID</label>
            <input
              type="text"
              value={tweetId}
              onChange={(e) => setTweetId(e.target.value)}
              placeholder="Enter tweet ID (e.g., 1234567890)"
              className="w-full p-3 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Action to Verify</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'like' | 'retweet' | 'reply')}
              className="w-full p-3 border border-gray-300 rounded-md"
            >
              <option value="like">Like</option>
              <option value="retweet">Retweet</option>
              <option value="reply">Reply</option>
            </select>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleGetBeforeCounts}
              disabled={loading}
              className="flex-1 bg-blue-500 text-white p-3 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Step 1: Get Before Counts'}
            </button>
            
            <button
              onClick={handleQuickVerify}
              disabled={loading}
              className="flex-1 bg-green-500 text-white p-3 rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Quick Verify (Auto)'}
            </button>
          </div>
        </div>
      )}

      {/* Before Counts Step */}
      {step === 'before' && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Fetching initial tweet counts...</p>
        </div>
      )}

      {/* Waiting Step */}
      {step === 'waiting' && beforeCounts && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Before Counts:</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Likes: {beforeCounts.likes}</div>
              <div>Retweets: {beforeCounts.retweets}</div>
              <div>Replies: {beforeCounts.replies}</div>
              <div>Quotes: {beforeCounts.quotes}</div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-md border-l-4 border-yellow-400">
            <p className="font-semibold">Step 2: Complete the {action} action now!</p>
            <p className="text-sm text-gray-600 mt-1">
              Go to Twitter and {action} the tweet, then click the button below.
            </p>
          </div>
          
          <button
            onClick={handleGetAfterCounts}
            disabled={loading}
            className="w-full bg-green-500 text-white p-3 rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Step 3: Verify Action'}
          </button>
        </div>
      )}

      {/* After Counts Step */}
      {step === 'after' && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p>Fetching updated counts and verifying...</p>
        </div>
      )}

      {/* Result Step */}
      {step === 'result' && verificationResult && (
        <div className="space-y-4">
          <div className={`p-4 rounded-md ${verificationResult.verified ? 'bg-green-50 border-l-4 border-green-400' : 'bg-red-50 border-l-4 border-red-400'}`}>
            <h3 className="font-semibold mb-2">
              {verificationResult.verified ? '✅ Verification Successful!' : '❌ Verification Failed'}
            </h3>
            <p className="text-sm">{verificationResult.message}</p>
            <p className="text-xs text-gray-500 mt-2">
              Confidence: {verificationResult.confidence} | Service: {verificationResult.service}
            </p>
          </div>

          {beforeCounts && afterCounts && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-semibold mb-2">Count Comparison:</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium">Before</div>
                  <div>Likes: {beforeCounts.likes}</div>
                  <div>Retweets: {beforeCounts.retweets}</div>
                  <div>Replies: {beforeCounts.replies}</div>
                </div>
                <div>
                  <div className="font-medium">After</div>
                  <div>Likes: {afterCounts.likes}</div>
                  <div>Retweets: {afterCounts.retweets}</div>
                  <div>Replies: {afterCounts.replies}</div>
                </div>
                <div>
                  <div className="font-medium">Difference</div>
                  <div>Likes: +{afterCounts.likes - beforeCounts.likes}</div>
                  <div>Retweets: +{afterCounts.retweets - beforeCounts.retweets}</div>
                  <div>Replies: +{afterCounts.replies - beforeCounts.replies}</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full bg-gray-500 text-white p-3 rounded-md hover:bg-gray-600"
          >
            Start New Verification
          </button>
        </div>
      )}
    </div>
  );
}