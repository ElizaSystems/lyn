'use client'

import { useState, useEffect } from 'react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'
import { Wallet, TrendingUp, Activity, Coins, ExternalLink, Copy, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WalletData {
  solBalance: number
  lynBalance: number
  totalTransactions: number
  address: string
  isLoading: boolean
}

export function AgentWallet() {
  const [walletData, setWalletData] = useState<WalletData>({
    solBalance: 0,
    lynBalance: 0,
    totalTransactions: 0,
    address: '',
    isLoading: true
  })
  const [copied, setCopied] = useState(false)

  // Configuration from environment
  const AGENT_WALLET = process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq'
  const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'
  const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS) || 6
  const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'

  useEffect(() => {
    const fetch = async () => {
      try {
        const connection = new Connection(RPC_ENDPOINT, 'confirmed')
        const agentPubkey = new PublicKey(AGENT_WALLET)
        
        // Fetch SOL balance
        const solBalance = await connection.getBalance(agentPubkey)
        
        // Fetch LYN token balance
        let lynBalance = 0
        try {
          const mintPubkey = new PublicKey(TOKEN_MINT)
          const tokenAccountAddress = await getAssociatedTokenAddress(
            mintPubkey,
            agentPubkey
          )
          
          const tokenAccount = await getAccount(
            connection,
            tokenAccountAddress
          )
          lynBalance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_DECIMALS)
        } catch {
          // Token account doesn't exist
          lynBalance = 0
        }
        
        // Fetch recent transactions count (simplified)
        const signatures = await connection.getSignaturesForAddress(agentPubkey, { limit: 100 })
        
        setWalletData({
          solBalance: solBalance / LAMPORTS_PER_SOL,
          lynBalance: lynBalance,
          totalTransactions: signatures.length,
          address: AGENT_WALLET,
          isLoading: false
        })
      } catch (error) {
        console.error('Error fetching agent wallet data:', error)
        setWalletData(prev => ({ ...prev, isLoading: false }))
      }
    }
    
    fetch()
    // Refresh every 30 seconds
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [AGENT_WALLET, RPC_ENDPOINT, TOKEN_MINT, TOKEN_DECIMALS])

  const fetchWalletData = async () => {
    try {
      const connection = new Connection(RPC_ENDPOINT, 'confirmed')
      const agentPubkey = new PublicKey(AGENT_WALLET)
      
      // Fetch SOL balance
      const solBalance = await connection.getBalance(agentPubkey)
      
      // Fetch LYN token balance
      let lynBalance = 0
      try {
        const mintPubkey = new PublicKey(TOKEN_MINT)
        const tokenAccountAddress = await getAssociatedTokenAddress(
          mintPubkey,
          agentPubkey
        )
        
        const tokenAccount = await getAccount(
          connection,
          tokenAccountAddress
        )
        lynBalance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_DECIMALS)
      } catch {
        // Token account doesn't exist
        lynBalance = 0
      }
      
      // Fetch recent transactions count (simplified)
      const signatures = await connection.getSignaturesForAddress(agentPubkey, { limit: 100 })
      
      setWalletData({
        solBalance: solBalance / LAMPORTS_PER_SOL,
        lynBalance: lynBalance,
        totalTransactions: signatures.length,
        address: AGENT_WALLET,
        isLoading: false
      })
    } catch (error) {
      console.error('Error fetching agent wallet data:', error)
      setWalletData(prev => ({ ...prev, isLoading: false }))
    }
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(walletData.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const openExplorer = () => {
    window.open(`https://solscan.io/account/${AGENT_WALLET}`, '_blank')
  }

  if (walletData.isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Agent&apos;s Wallet</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchWalletData}
          className="h-7 px-2"
        >
          <Activity className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-3">
        {/* Wallet Address */}
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
          <span className="text-xs text-muted-foreground">
            {formatAddress(walletData.address)}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={copyAddress}
              className="h-6 w-6 p-0"
            >
              {copied ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={openExplorer}
              className="h-6 w-6 p-0"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* SOL Balance */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">SOL Balance</span>
            <TrendingUp className="h-3 w-3 text-green-500" />
          </div>
          <div className="text-2xl font-bold">
            {walletData.solBalance.toFixed(4)}
            <span className="text-sm font-normal text-muted-foreground ml-1">SOL</span>
          </div>
        </div>

        {/* LYN Token Balance */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">LYN Balance</span>
            <Coins className="h-3 w-3 text-primary" />
          </div>
          <div className="text-2xl font-bold">
            {walletData.lynBalance.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-1">LYN</span>
          </div>
        </div>

        {/* Transaction Activity */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Recent Activity</span>
            <span className="text-xs">
              {walletData.totalTransactions}+ transactions
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-green-600 dark:text-green-400">
            Agent Active
          </span>
        </div>
      </div>
    </div>
  )
}