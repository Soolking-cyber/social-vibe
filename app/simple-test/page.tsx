"use client"

import { signIn, signOut, useSession } from "next-auth/react"

export default function SimpleTestPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div style={{ padding: '20px' }}>Loading...</div>
  }

  if (session) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>✅ Authentication Successful!</h1>
        <p>Welcome, {session.user?.name}!</p>
        <p>Email: {session.user?.email}</p>
        <img src={session.user?.image || ''} alt="Profile" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
        <br />
        <button onClick={() => signOut()} style={{ padding: '10px', marginTop: '10px' }}>
          Sign Out
        </button>
        <pre style={{ background: '#f5f5f5', padding: '10px', marginTop: '10px' }}>
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Simple Twitter Auth Test</h1>
      <p>This test uses in-memory sessions (no database)</p>
      <button 
        onClick={() => signIn('twitter')}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#1da1f2', 
          color: 'white', 
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Sign in with Twitter
      </button>
    </div>
  )
}