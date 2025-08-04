"use client"

export default function DebugPage() {
  const testAuth = async () => {
    try {
      const response = await fetch('/api/auth/providers')
      const data = await response.json()
      console.log('Auth providers:', data)
    } catch (error) {
      console.error('Auth error:', error)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Debug Page</h1>
      <button onClick={testAuth} style={{ padding: '10px', margin: '10px' }}>
        Test Auth Providers
      </button>
      <div>
        <h3>Environment Check:</h3>
        <p>NEXTAUTH_URL: {process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'Not set'}</p>
        <p>Twitter Client ID: {process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID ? 'Set' : 'Not set'}</p>
      </div>
      <div>
        <h3>Direct Auth Test:</h3>
        <a href="/api/auth/signin/twitter" style={{ 
          display: 'inline-block', 
          padding: '10px 20px', 
          backgroundColor: '#1da1f2', 
          color: 'white', 
          textDecoration: 'none',
          borderRadius: '5px'
        }}>
          Direct Twitter Auth Link
        </a>
      </div>
    </div>
  )
}