/**
 * Twitter Action Verification Script
 * This script runs on Twitter pages to detect if actions were completed
 */

(function() {
  'use strict';

  // Get verification ID from URL parameters or localStorage
  function getVerificationId() {
    const urlParams = new URLSearchParams(window.location.search);
    const verificationId = urlParams.get('verification_id') || 
                          localStorage.getItem('current_verification_id');
    return verificationId;
  }

  // Check if user has liked the current tweet
  function checkLikeAction() {
    // Look for liked state indicators on Twitter
    const likeButtons = document.querySelectorAll('[data-testid="like"], [aria-label*="like"], [aria-label*="Like"]');
    
    for (const button of likeButtons) {
      // Check if the like button is in "liked" state
      if (button.getAttribute('aria-pressed') === 'true' ||
          button.classList.contains('liked') ||
          button.querySelector('[fill="rgb(249, 24, 128)"]') || // Twitter's red heart color
          button.querySelector('svg[fill="#f91880"]')) {
        return true;
      }
    }
    
    return false;
  }

  // Check if user has retweeted the current tweet
  function checkRetweetAction() {
    // Look for retweeted state indicators
    const retweetButtons = document.querySelectorAll('[data-testid="retweet"], [aria-label*="retweet"], [aria-label*="Retweet"]');
    
    for (const button of retweetButtons) {
      // Check if the retweet button is in "retweeted" state
      if (button.getAttribute('aria-pressed') === 'true' ||
          button.classList.contains('retweeted') ||
          button.querySelector('[fill="rgb(0, 186, 124)"]') || // Twitter's green retweet color
          button.querySelector('svg[fill="#00ba7c"]')) {
        return true;
      }
    }
    
    return false;
  }

  // Check if user has commented on the current tweet
  function checkCommentAction(expectedComment) {
    // This is more complex - we'd need to check if there's a recent comment
    // For now, we'll use a simpler approach
    const commentButtons = document.querySelectorAll('[data-testid="reply"], [aria-label*="reply"], [aria-label*="Reply"]');
    
    // Check if the compose tweet dialog is open or was recently used
    const composeDialog = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (composeDialog && composeDialog.value && composeDialog.value.includes(expectedComment)) {
      return true;
    }
    
    // Check for recent tweets in the timeline that match the expected comment
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    for (const tweet of tweets) {
      const tweetText = tweet.textContent || '';
      if (tweetText.includes(expectedComment)) {
        return true;
      }
    }
    
    return false;
  }

  // Main verification function
  function verifyAction() {
    const verificationId = getVerificationId();
    if (!verificationId) {
      console.log('No verification ID found');
      return;
    }

    // Get verification data from localStorage
    let verificationData;
    try {
      const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
      if (!stored) {
        console.log('No verification data found');
        return;
      }
      verificationData = JSON.parse(stored);
    } catch (error) {
      console.log('Error parsing verification data:', error);
      return;
    }

    const { actionType, expectedComment } = verificationData;
    let actionCompleted = false;

    // Check based on action type
    switch (actionType) {
      case 'like':
        actionCompleted = checkLikeAction();
        break;
      case 'retweet':
        actionCompleted = checkRetweetAction();
        break;
      case 'comment':
        actionCompleted = checkCommentAction(expectedComment);
        break;
      default:
        console.log('Unknown action type:', actionType);
        return;
    }

    console.log(`Action ${actionType} completed:`, actionCompleted);

    // If action is completed, mark it as verified
    if (actionCompleted) {
      try {
        localStorage.setItem(`twitter_action_verified_${verificationId}`, 'true');
        localStorage.setItem(`twitter_action_verified_time_${verificationId}`, Date.now().toString());
        
        // Send message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'twitter_action_completed',
            verificationId: verificationId,
            actionType: actionType,
            verified: true
          }, '*');
        }
        
        console.log('Action verified and marked as completed');
      } catch (error) {
        console.log('Error marking action as verified:', error);
      }
    }
  }

  // Run verification when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verifyAction);
  } else {
    verifyAction();
  }

  // Also run verification periodically to catch dynamic changes
  setInterval(verifyAction, 2000);

  // Run verification when user interacts with the page
  document.addEventListener('click', function() {
    setTimeout(verifyAction, 1000); // Delay to allow UI updates
  });

})();