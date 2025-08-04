"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import WalletCard from "@/components/WalletCard"

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [walletValue, setWalletValue] = useState<any>(null)
  const [twitterHandle, setTwitterHandle] = useState<string>('')

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchUserStats()
      fetchWalletValue()
    }
  }, [session])

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/user/stats')
      if (response.ok) {
        const data = await response.json()
        console.log('User stats data:', data) // Debug log
        setStats(data)
        // Set Twitter handle from API response
        setTwitterHandle(data.twitterHandle || '')
      } else {
        console.error('Failed to fetch user stats:', response.status)
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
    }
  }

  const fetchWalletValue = async (forceRefresh = false) => {
    try {
      const endpoint = forceRefresh ? '/api/wallet/refresh' : '/api/wallet/value'
      const method = forceRefresh ? 'POST' : 'GET'

      const response = await fetch(endpoint, { method })
      if (response.ok) {
        const data = await response.json()
        console.log('Wallet value data:', data) // Debug log
        setWalletValue(data)
      } else {
        console.error('Failed to fetch wallet value:', response.status)
      }
    } catch (error) {
      console.error('Error fetching wallet value:', error)
    }
  }

  const refreshBalances = async () => {
    console.log('Refreshing balances from blockchain...')
    await Promise.all([
      fetchUserStats(),
      fetchWalletValue(true) // Force refresh from blockchain
    ])
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-300">Loading...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to Social Impact
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Create positive social impact through meaningful Twitter engagement. Choose how you want to make a difference.
          </p>
        </div>

        {/* User Profile and Wallet */}
        <div className="max-w-6xl mx-auto mb-12 grid md:grid-cols-2 gap-6">
          {/* User Profile */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-16 h-16 rounded-full border-2 border-slate-700"
                  />
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">{session.user?.name}</h2>
                  <p className="text-slate-400">
                    {twitterHandle ? `@${twitterHandle}` : `@${session.user?.name}`}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">
                  {walletValue?.usdValues?.formattedTotal || '$0.00'}
                </div>
                <div className="text-sm text-slate-400">Total Wallet Value</div>
                {walletValue && (
                  <div className="text-xs text-slate-500 mt-1">
                    {parseFloat(walletValue.balances?.eth || '0').toFixed(4)} ETH + {parseFloat(walletValue.balances?.usdc || '0').toFixed(2)} USDC
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Wallet Card */}
          <WalletCard
            wallet={stats?.wallet || null}
            onRefresh={refreshBalances}
            walletValue={walletValue}
          />
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          <Card
            className="bg-slate-900 border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors"
            onClick={() => router.push('/marketplace')}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <CardTitle className="text-white text-2xl">Browse Jobs</CardTitle>
              <CardDescription className="text-slate-400">
                Find engagement opportunities and start earning money immediately
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Start Earning →
              </Button>
            </CardContent>
          </Card>

          <Card
            className="bg-slate-900 border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors"
            onClick={() => router.push('/create-job')}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <CardTitle className="text-white text-2xl">Create Job</CardTitle>
              <CardDescription className="text-slate-400">
                Post engagement jobs to grow your Twitter presence with real users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-green-600 hover:bg-green-700">
                Create Job →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}