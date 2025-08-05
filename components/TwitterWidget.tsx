'use client';

// DEPRECATED: Use SafeTwitterWidget instead
// This component is kept for backward compatibility but redirects to the safe version

import { SafeTwitterWidget } from './SafeTwitterWidget';

interface TwitterWidgetProps {
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'reply' | 'comment';
  onInteraction?: (type: 'like' | 'retweet' | 'reply' | 'comment') => void;
  onVerificationReady?: (verificationId: string) => void;
}

// Redirect to SafeTwitterWidget to prevent DOM manipulation errors
export function TwitterWidget(props: TwitterWidgetProps) {
  console.warn('TwitterWidget is deprecated. Use SafeTwitterWidget instead.');
  return <SafeTwitterWidget {...props} />;
}