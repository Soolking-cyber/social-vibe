// Quick test script to check what the API returns
// Run this in the browser console on your dashboard page

async function testTwitterHandle() {
  try {
    console.log('=== Testing Twitter Handle API ===');
    
    const response = await fetch('/api/user/stats');
    const data = await response.json();
    
    console.log('Full API Response:', data);
    console.log('Twitter Handle:', data.twitterHandle);
    console.log('Twitter Handle Type:', typeof data.twitterHandle);
    console.log('Is null?', data.twitterHandle === null);
    console.log('Is undefined?', data.twitterHandle === undefined);
    console.log('Is empty string?', data.twitterHandle === '');
    
    // Also test the user info debug endpoint
    const debugResponse = await fetch('/api/debug/user-info');
    const debugData = await debugResponse.json();
    
    console.log('=== Debug User Info ===');
    console.log('Database Twitter Handle:', debugData.database_info?.user_data?.twitter_handle);
    console.log('Session Twitter Handle:', debugData.session_info?.twitter_handle_from_session);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testTwitterHandle();