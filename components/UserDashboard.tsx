'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { TwitterHandleManager } from './TwitterHandleManager';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UserStats {
  balance: number;
  totalEarned: number;
  earnedBalance: number;
  canWithdraw: boolean;
  withdrawalThreshold: number;
  jobsCreated: number;
  jobsCompleted: number;
  twitterHandle?: string | null;
  wallet?: {
    address: string;
    balances: {
      eth: string;
      usdc: string;
    };
  } | null;
}

interface UserDashboardProps {
  onRefresh?: () => Promise<void>;
}

export default function UserDashboard({ onRefresh }: UserDashboardProps = {}) {
  const { data: session } = useSession();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [walletValue, setWalletValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  useEffect(() => {
    if (session) {
      fetchUserStats();
      fetchWalletValue();
    }
  }, [session]);

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/user/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletValue = async (fresh = false) => {
    try {
      const url = fresh ? '/api/wallet/value?fresh=true' : '/api/wallet/value';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setWalletValue(data);
      }
    } catch (error) {
      console.error('Error fetching wallet value:', error);
    }
  };

  const refreshAllData = async () => {
    setRefreshing(true);
    try {
      // Fetch fresh on-chain balances and backend data in parallel
      await Promise.all([
        fetchUserStats(),
        fetchWalletValue(true), // Fetch fresh on-chain balances
        onRefresh?.() // Call parent refresh if provided
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!session) return null;

  if (loading) {
    return (
      <Card className="mb-8 bg-slate-900 border-slate-800">
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-400">Loading dashboard...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-8">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <CardTitle className="text-white">Welcome, {session.user?.name}</CardTitle>
                <CardDescription className="text-slate-400">
                  Your earnings dashboard
                  {stats?.twitterHandle && (
                    <span className="block text-xs text-blue-400 mt-1">
                      Twitter: @{stats.twitterHandle}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={refreshAllData}
                disabled={refreshing}
                variant="outline"
                size="sm"
                className="border-green-600 text-green-400 hover:bg-green-600/10 disabled:opacity-50"
              >
                {refreshing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                    Refreshing...
                  </div>
                ) : (
                  'Refresh All Data'
                )}
              </Button>


            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Wallet Balance */}
            <div className="bg-slate-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {walletValue?.usdValues?.formattedTotal || '$0.00'}
              </div>
              <div className="text-sm text-slate-400 mb-1">Wallet Value</div>
              {walletValue && (
                <div className="text-xs text-slate-500 mb-2">
                  {parseFloat(walletValue.balances?.eth || '0').toFixed(4)} ETH + {parseFloat(walletValue.balances?.usdc || '0').toFixed(2)} USDC
                </div>
              )}
              <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                    Deposit Crypto
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Deposit Crypto</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Send ETH or USDC to your wallet address
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {stats?.wallet?.address ? (
                      <>
                        <div>
                          <Label className="text-white">Your Wallet Address</Label>
                          <div className="flex gap-2 mt-2">
                            <Input
                              value={stats.wallet.address}
                              readOnly
                              className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                            />
                            <Button
                              onClick={() => {
                                if (stats?.wallet?.address) {
                                  navigator.clipboard.writeText(stats.wallet.address)
                                  alert('Address copied!')
                                }
                              }}
                              variant="outline"
                              className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <h4 className="text-white font-medium mb-2">Get Test Tokens:</h4>
                          <div className="space-y-2">
                            <Button
                              onClick={() => window.open('https://sepoliafaucet.com/', '_blank')}
                              variant="outline"
                              size="sm"
                              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                              Get Sepolia ETH
                            </Button>
                            <Button
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/wallet/get-test-usdc', {
                                    method: 'POST'
                                  });
                                  const data = await response.json();
                                  if (data.success) {
                                    alert(`Success! ${data.message}\nNew Balance: ${data.new_balance} USDC`);
                                    await fetchUserStats();
                                    await fetchWalletValue();
                                  } else {
                                    alert(`Error: ${data.error}`);
                                  }
                                } catch (error) {
                                  alert('Failed to get test USDC');
                                }
                              }}
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-700"
                            >
                              Get 100 Test USDC
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-white">View on Blockchain:</Label>
                          <div className="mt-2">
                            <Button
                              onClick={() => {
                                if (stats?.wallet?.address) {
                                  window.open(`https://sepolia.etherscan.io/address/${stats.wallet.address}`, '_blank')
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                              View on Etherscan
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <div className="text-slate-400 mb-2">Wallet not found</div>
                        <Button
                          onClick={() => window.location.reload()}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Refresh Page
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Earned Balance */}
            <div className="bg-slate-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">
                ${stats?.earnedBalance?.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-slate-400 mb-2">Earned Balance</div>
              {stats?.canWithdraw ? (
                <div className="space-y-2">
                  <Button
                    onClick={async () => {
                      setWithdrawing(true);
                      try {
                        const response = await fetch('/api/contract/withdraw-earnings', {
                          method: 'POST'
                        });
                        const data = await response.json();
                        if (data.success) {
                          alert(`Success! Withdrew ${data.withdrawnAmount} USDC to your wallet.`);
                          await fetchUserStats();
                          await fetchWalletValue();
                        } else {
                          if (data.error && data.error.includes('Insufficient ETH balance')) {
                            alert(`${data.error}\n\nTo fix this:\n1. Click "Check ETH Balance" to see your current ETH\n2. Click "Get Sepolia ETH" to get test ETH\n3. Wait a few minutes for the ETH to arrive\n4. Try withdrawing again`);
                            await fetchWalletValue();
                          } else {
                            alert(`Error: ${data.error}`);
                          }
                        }
                      } catch (error) {
                        alert('Failed to withdraw earnings');
                      } finally {
                        setWithdrawing(false);
                      }
                    }}
                    disabled={withdrawing}
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {withdrawing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : (
                      'Withdraw Earnings'
                    )}
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/debug/eth-balance');
                        const data = await response.json();
                        if (data.success) {
                          const debug = data.debug;
                          const message = `ETH Balance Debug:\n\n` +
                            `Wallet: ${debug.walletAddress}\n` +
                            `Cached ETH: ${debug.cachedBalances.eth} ETH\n` +
                            `Fresh ETH: ${debug.freshBalances?.eth || 'Failed to fetch'} ETH\n` +
                            `Earned: $${debug.earnedBalance.toFixed(2)} USDC\n` +
                            `Min ETH needed: ${debug.minEthRequired} ETH\n\n` +
                            `Status:\n` +
                            `- Can withdraw: ${debug.recommendations.readyToWithdraw ? 'Yes' : 'No'}\n` +
                            `- Needs more ETH: ${debug.recommendations.needsEth ? 'Yes' : 'No'}\n` +
                            `- Needs more earnings: ${debug.recommendations.needsMoreEarnings ? 'Yes' : 'No'}`;
                          alert(message);
                        } else {
                          alert(`Debug failed: ${data.error}`);
                        }
                      } catch (error) {
                        alert('Failed to debug ETH balance');
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Debug ETH Balance
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Need ${stats?.withdrawalThreshold || 10} to withdraw
                </div>
              )}
            </div>

            {/* Jobs Created */}
            <div className="bg-slate-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {stats?.jobsCreated || 0}
              </div>
              <div className="text-sm text-slate-400">Jobs Created</div>
            </div>

            {/* Jobs Completed */}
            <div className="bg-slate-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {stats?.jobsCompleted || 0}
              </div>
              <div className="text-sm text-slate-400">Jobs Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Twitter Handle Management */}
      <TwitterHandleManager onUpdate={fetchUserStats} />
    </div>
  );
}