'use client'
import { useState, useEffect } from 'react'
import { Wallet, Copy, ExternalLink, Shield, TrendingUp, ArrowUpRight, ArrowDownLeft, Clock, RefreshCw, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shortenAddress } from '@/lib/solana'

export default function WalletPage() {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<{ sol: number; token: number; tokenSymbol: string } | null>(null)
  const [tokens, setTokens] = useState<Array<{ symbol: string; name: string; balance: string; value: string; change: string }>>([])
  const [transactions, setTransactions] = useState<Array<{ signature: string; type: string; amount: string; from?: string; to?: string; time?: string; timestamp?: number }>>([])
  const [totalValue, setTotalValue] = useState(0)
  
  const walletAddress = 'eS5PgEoCFN2KuJnBfgvoenFJ7THDhvWZzBJ2SrxwkX1'
  const shortAddress = shortenAddress(walletAddress, 6)

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fetchWalletData = async () => {
    setLoading(true)
    try {
      // Fetch balances
      const balanceRes = await fetch('/api/wallet/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      })
      const balanceData = await balanceRes.json()
      setBalances(balanceData)

      // Fetch all token balances
      const tokensRes = await fetch('/api/wallet/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      })
      const tokensData = await tokensRes.json()
      setTokens(tokensData.tokens || [])
      setTotalValue(tokensData.totalValue || 0)

      // Fetch transactions
      const txRes = await fetch('/api/wallet/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, limit: 10 })
      })
      const txData = await txRes.json()
      setTransactions(txData.transactions || [])
    } catch (error) {
      console.error('Error fetching wallet data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWalletData()
    const interval = setInterval(fetchWalletData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown'
    const now = Date.now() / 1000
    const diff = now - timestamp
    
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Agent Wallet</h1>
              <p className="text-sm text-muted-foreground">Manage your digital assets</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={fetchWalletData}
              disabled={loading}
              className="border-border/50 hover:bg-primary/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              <Activity className="w-4 h-4 mr-2" />
              Live
            </Button>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Wallet Address</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono">{shortAddress}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="hover:bg-primary/10"
                >
                  {copied ? 'Copied!' : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-primary/10"
                  onClick={() => window.open(`https://solscan.io/account/${walletAddress}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 w-24 bg-primary/20 rounded mb-1"></div>
                  <div className="h-4 w-16 bg-primary/20 rounded"></div>
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold">${formatNumber(totalValue)}</p>
                  <p className="text-sm text-muted-foreground">
                    {balances?.sol ? `${formatNumber(balances.sol, 4)} SOL` : '0 SOL'}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 bg-primary hover:bg-primary/90">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Send
            </Button>
            <Button variant="outline" className="flex-1 border-border/50 hover:bg-primary/10">
              <ArrowDownLeft className="w-4 h-4 mr-2" />
              Receive
            </Button>
            <Button variant="outline" className="flex-1 border-border/50 hover:bg-primary/10">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Token Balances
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-primary/10 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
              {tokens.length > 0 ? tokens.map((token) => (
                <div key={token.symbol} className="flex items-center justify-between p-3 rounded-lg hover:bg-card/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <span className="text-xs font-bold">{token.symbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{token.symbol}</p>
                      <p className="text-sm text-muted-foreground">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{token.balance}</p>
                    <p className="text-sm text-muted-foreground">{token.value}</p>
                    <p className={`text-xs ${token.change.startsWith('+') ? 'text-green-500' : token.change.startsWith('-') ? 'text-red-500' : 'text-gray-500'}`}>
                      {token.change}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No tokens found</p>
                </div>
              )}
            </div>
            )}
          </div>

          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Recent Transactions
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-primary/10 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
              {transactions.length > 0 ? transactions.map((tx, index) => (
                <div key={tx.signature || index} className="flex items-center justify-between p-3 rounded-lg hover:bg-card/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === 'receive' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {tx.type === 'receive' ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {tx.type === 'receive' ? 'Received' : 'Sent'} {tx.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.type === 'receive' ? `From ${tx.from}` : `To ${tx.to}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{formatTime(tx.timestamp ?? null) || tx.time}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:bg-primary/10 p-1 h-auto"
                      onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent transactions</p>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50 bg-primary/5">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Security Status: Protected</p>
              <p className="text-xs text-muted-foreground">Multi-signature enabled • 2FA active • Last audit: 2 days ago</p>
            </div>
            <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10">
              View Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
