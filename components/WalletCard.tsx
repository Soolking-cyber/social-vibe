"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WalletData {
  address: string
  balances: {
    eth: string
    usdc: string
  }
}

interface WalletCardProps {
  wallet: WalletData | null
  onRefresh: () => Promise<void>
  walletValue?: {
    usdValues: {
      ethValueUsd: number
      usdcValueUsd: number
      totalValueUsd: number
      formattedTotal: string
    }
    ethPrice: number
  } | null
}

export default function WalletCard({ wallet, onRefresh, walletValue }: WalletCardProps) {
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawToken, setWithdrawToken] = useState('ETH')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState<{
    transactionHash: string
    amount: string
    token: string
    toAddress: string
    newBalance: string
  } | null>(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } catch (error) {
      console.error('Error refreshing wallet:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (!wallet) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Wallet</CardTitle>
          <CardDescription className="text-slate-400">
            No wallet found. A wallet will be created automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </div>
            ) : (
              'Generate Wallet'
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress || !withdrawToken) {
      alert('Please enter amount, address, and select token')
      return
    }

    // Validate amount
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawAddress)) {
      alert('Please enter a valid Ethereum address')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token: withdrawToken,
          amount: withdrawAmount,
          toAddress: withdrawAddress
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Set success data and show success modal
        setSuccessData({
          transactionHash: data.transactionHash,
          amount: withdrawAmount,
          token: withdrawToken,
          toAddress: withdrawAddress,
          newBalance: data.newBalance
        })
        setShowSuccessModal(true)
        
        // Refresh wallet data
        if (onRefresh) {
          await onRefresh()
        }
        
        // Close withdraw modal and reset form
        setShowWithdrawModal(false)
        setWithdrawAmount('')
        setWithdrawAddress('')
        setWithdrawToken('ETH')
      } else {
        alert(`❌ Withdrawal failed:\n\n${data.error}`)
      }
    } catch (error) {
      console.error('Withdrawal error:', error)
      alert('❌ Withdrawal failed: Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getAvailableBalance = () => {
    if (withdrawToken === 'ETH') {
      return wallet?.balances?.eth ? parseFloat(wallet.balances.eth).toFixed(4) : '0.0000'
    } else {
      return wallet?.balances?.usdc ? parseFloat(wallet.balances.usdc).toFixed(2) : '0.00'
    }
  }



  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          Crypto Wallet
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {refreshing ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
                Refreshing...
              </div>
            ) : (
              'Refresh'
            )}
          </Button>
        </CardTitle>
        <CardDescription className="text-slate-400 font-mono text-xs">
          {wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'No address'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balances */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`bg-slate-800 p-3 rounded-lg text-center relative ${refreshing ? 'opacity-60' : ''}`}>
            {refreshing && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 rounded-lg">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <div className="text-lg font-bold text-blue-400">
              {wallet.balances?.eth ? parseFloat(wallet.balances.eth).toFixed(4) : '0.0000'} ETH
            </div>
            <div className="text-xs text-slate-400">Gas Fees</div>
            {walletValue && (
              <div className="text-xs text-slate-500 mt-1">
                ≈ ${walletValue.usdValues.ethValueUsd.toFixed(2)}
              </div>
            )}
          </div>
          <div className={`bg-slate-800 p-3 rounded-lg text-center relative ${refreshing ? 'opacity-60' : ''}`}>
            {refreshing && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 rounded-lg">
                <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <div className="text-lg font-bold text-green-400">
              {wallet.balances?.usdc ? parseFloat(wallet.balances.usdc).toFixed(2) : '0.00'} USDC
            </div>
            <div className="text-xs text-slate-400">Payments</div>
            {walletValue && (
              <div className="text-xs text-slate-500 mt-1">
                ≈ ${walletValue.usdValues.usdcValueUsd.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          {/* Deposit Modal */}
          <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                Deposit
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
                <div>
                  <Label className="text-white">Your Wallet Address</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={wallet.address || ''}
                      readOnly
                      className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                    />
                    <Button
                      onClick={() => {
                        if (wallet.address) {
                          navigator.clipboard.writeText(wallet.address)
                          alert('Address copied!')
                        }
                      }}
                      variant="outline"
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      disabled={!wallet.address}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg">
                  <h4 className="text-white font-medium mb-2">Blockchain Explorer:</h4>
                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        if (wallet.address) {
                          window.open(`https://etherscan.io/address/${wallet.address}`, '_blank')
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                      disabled={!wallet.address}
                    >
                      View on Etherscan
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Withdraw Modal */}
          <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-white">Withdraw Crypto</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Send your crypto to another wallet
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Token Selection */}
                <div>
                  <Label className="text-white">Token</Label>
                  <Select value={withdrawToken} onValueChange={setWithdrawToken}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="ETH" className="text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                          ETH - Ethereum
                        </div>
                      </SelectItem>
                      <SelectItem value="USDC" className="text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                          USDC - USD Coin
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Input */}
                <div>
                  <Label className="text-white">Amount ({withdrawToken})</Label>
                  <Input
                    type="number"
                    step={withdrawToken === 'ETH' ? '0.0001' : '0.01'}
                    placeholder={withdrawToken === 'ETH' ? '0.0000' : '0.00'}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-slate-400">
                      Available: {getAvailableBalance()} {withdrawToken}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setWithdrawAmount(getAvailableBalance())}
                      className="text-xs text-blue-400 hover:text-blue-300 h-auto p-1"
                    >
                      Max
                    </Button>
                  </div>
                </div>

                {/* Address Input */}
                <div>
                  <Label className="text-white">To Address</Label>
                  <Input
                    placeholder="0x..."
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Enter the recipient's wallet address
                  </div>
                </div>

                {/* Transaction Fee Warning */}
                {withdrawToken === 'USDC' && (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                    <div className="text-yellow-400 text-sm font-medium mb-1">
                      ⚠️ Gas Fee Required
                    </div>
                    <div className="text-yellow-300 text-xs">
                      USDC transfers require ETH for gas fees. Make sure you have enough ETH in your wallet.
                    </div>
                  </div>
                )}

                {/* Withdraw Button */}
                <Button
                  onClick={handleWithdraw}
                  disabled={loading || !withdrawAmount || !withdrawAddress || !withdrawToken}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    `Withdraw ${withdrawAmount || '0'} ${withdrawToken}`
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Recent Transactions */}
        <div className="pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-300">Recent Transactions</h4>
            <Button
              onClick={() => window.open(`https://etherscan.io/address/${wallet.address}`, '_blank')}
              variant="ghost"
              size="sm"
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              View All →
            </Button>
          </div>
          <div className="text-xs text-slate-400">
            Check Etherscan for transaction status and history
          </div>
        </div>
      </CardContent>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Withdrawal Successful!
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Your transaction has been sent to the blockchain
            </DialogDescription>
          </DialogHeader>
          {successData && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white font-medium">{successData.amount} {successData.token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">To Address:</span>
                  <span className="text-white font-mono text-sm">
                    {successData.toAddress.slice(0, 6)}...{successData.toAddress.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">New Balance:</span>
                  <span className="text-green-400 font-medium">{successData.newBalance} {successData.token}</span>
                </div>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-800 p-3 rounded-lg">
                <div className="text-blue-400 text-sm font-medium mb-1">Transaction Hash:</div>
                <div className="text-blue-300 font-mono text-xs break-all">{successData.transactionHash}</div>
                <Button
                  onClick={() => window.open(`https://etherscan.io/tx/${successData.transactionHash}`, '_blank')}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-blue-700 text-blue-300 hover:bg-blue-900/30"
                >
                  View on Etherscan
                </Button>
              </div>
              
              <Button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}