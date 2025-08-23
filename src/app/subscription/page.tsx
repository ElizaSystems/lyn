'use client'

import { useState, useEffect, Suspense } from 'react'
import { useWallet } from '@/components/solana/solana-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
  Crown, 
  Zap, 
  Shield, 
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle,
  Wallet,
  Gift,
  DollarSign,
  Info
} from 'lucide-react'
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import { useSearchParams } from 'next/navigation'

interface SubscriptionStatus {
  hasActiveSubscription: boolean
  subscription?: {
    status: string
    startDate: string
    endDate: string
    amount: number
    tier: string
  }
}

function SubscriptionContent() {
  const { connected, publicKey } = useWallet()
  const searchParams = useSearchParams()
  const referralCode = searchParams.get('ref')
  
  const [loading, setLoading] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [customReferralCode, setCustomReferralCode] = useState(referralCode || '')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Fetch subscription status
  useEffect(() => {
    if (connected && publicKey) {
      fetchSubscriptionStatus()
    }
  }, [connected, publicKey])

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription/status', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setSubscriptionStatus(data)
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
    }
  }

  const handleSubscribe = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)
    
    try {
      // Get the agent wallet address from environment or use default
      const agentWallet = process.env.NEXT_PUBLIC_AGENT_WALLET || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq'
      const feeWallet = process.env.NEXT_PUBLIC_FEE_WALLET || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq' // Use same as agent for now
      
      // Validate wallet addresses
      let agentPubkey: PublicKey
      let feePubkey: PublicKey
      
      try {
        agentPubkey = new PublicKey(agentWallet)
        feePubkey = new PublicKey(feeWallet)
      } catch (e) {
        console.error('Invalid agent or fee wallet configuration')
        setError('Service configuration error. Please contact support.')
        setLoading(false)
        return
      }
      
      // Create SOL transfer transaction with recent blockhash
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
      )

      // Prepare transaction and set fee payer + recent blockhash
      const transaction = new Transaction()
      
      // Safely handle publicKey - it should already be a PublicKey object
      let from: PublicKey
      try {
        if (publicKey instanceof PublicKey) {
          from = publicKey
        } else if (typeof publicKey === 'string') {
          from = new PublicKey(publicKey)
        } else if (publicKey && typeof publicKey.toBase58 === 'function') {
          // It's likely a PublicKey-like object
          from = new PublicKey(publicKey.toBase58())
        } else {
          throw new Error('Invalid wallet public key format')
        }
      } catch (e) {
        console.error('Error processing wallet public key:', e)
        setError('Invalid wallet address format')
        setLoading(false)
        return
      }
      
      const total = 0.5 * LAMPORTS_PER_SOL
      const refCode = (customReferralCode || '').trim()
      let referrerPubkey: PublicKey | null = null
      try {
        if (refCode) {
          const resp = await fetch(`/api/referral/v2/info?code=${encodeURIComponent(refCode)}`)
          if (resp.ok) {
            const info = await resp.json()
            if (info.walletAddress) {
              referrerPubkey = new PublicKey(info.walletAddress)
            }
          }
        }
      } catch {}

      const feeAmount = Math.floor(0.05 * total)
      const refAmount = referrerPubkey ? Math.floor(0.20 * total) : 0
      const agentAmount = total - feeAmount - refAmount

      // Agent transfer
      transaction.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: agentPubkey, lamports: agentAmount }))
      // Fee transfer
      transaction.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: feePubkey, lamports: feeAmount }))
      // Optional referrer transfer
      if (referrerPubkey && refAmount > 0) {
        transaction.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: referrerPubkey, lamports: refAmount }))
      }
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')
      transaction.recentBlockhash = blockhash
      transaction.lastValidBlockHeight = lastValidBlockHeight
      transaction.feePayer = from
      
      // Get wallet adapter to sign and send
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const solanaWindow = window as any
      const { solana } = solanaWindow
      if (!solana) {
        throw new Error('Wallet not found')
      }
      
      // Sign and send transaction
      const sendResult = await solana.signAndSendTransaction(transaction)
      const signature = sendResult?.signature || sendResult
      
      // Wait for confirmation
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      
      // Create subscription with referral code
      setProcessing(true)
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transactionSignature: signature,
          referralCode: customReferralCode || undefined
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setSuccess(true)
        await fetchSubscriptionStatus()
      } else {
        setError(result.error || 'Failed to activate subscription')
      }
    } catch (error: any) {
      console.error('Subscription error:', error)
      // Handle specific error types
      if (error?.message?.includes('Non-base58')) {
        setError('Wallet connection issue. Please reconnect your wallet and try again.')
      } else if (error?.message?.includes('insufficient')) {
        setError('Insufficient SOL balance for subscription')
      } else {
        setError(error?.message || 'Failed to process subscription. Please try again.')
      }
    } finally {
      setLoading(false)
      setProcessing(false)
    }
  }

  const features = [
    { icon: Zap, text: 'Priority Access to All Features' },
    { icon: Shield, text: 'Enhanced Security Scans' },
    { icon: TrendingUp, text: 'Advanced Analytics & Insights' },
    { icon: Users, text: 'Referral Network Benefits' },
    { icon: Crown, text: 'Exclusive Premium Badge' },
    { icon: Gift, text: 'Monthly Bonus Rewards' }
  ]

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Crown className="w-8 h-8 text-yellow-500" />
          <h1 className="text-4xl font-bold">Premium Subscription</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Unlock the full power of LYN AI with our premium tier
        </p>
      </div>

      {/* Subscription Status */}
      {subscriptionStatus?.hasActiveSubscription && (
        <Card className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
          <div className="flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Active Premium Subscription</h3>
              <p className="text-muted-foreground">
                Your subscription is active until {' '}
                {subscriptionStatus.subscription?.endDate && 
                  new Date(subscriptionStatus.subscription.endDate).toLocaleDateString()
                }
              </p>
            </div>
            <Crown className="w-12 h-12 text-yellow-500" />
          </div>
        </Card>
      )}

      {/* Main Subscription Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Premium Tier</h2>
              <div className="text-right">
                <p className="text-3xl font-bold">0.5 SOL</p>
                <p className="text-sm text-muted-foreground">per month</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <feature.icon className="w-5 h-5 text-primary" />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Referral Code Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Referral Code (Optional)</label>
            <Input
              placeholder="Enter referral code"
              value={customReferralCode}
              onChange={(e) => setCustomReferralCode(e.target.value)}
              disabled={loading || subscriptionStatus?.hasActiveSubscription}
            />
            {customReferralCode && (
              <p className="text-xs text-muted-foreground">
                Your referrer will receive 20% (0.10 SOL) reward
              </p>
            )}
          </div>

          {/* Subscribe Button */}
          {!subscriptionStatus?.hasActiveSubscription && (
            <Button
              onClick={handleSubscribe}
              disabled={!connected || loading || processing}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {loading ? (
                <>Processing...</>
              ) : !connected ? (
                <>Connect Wallet to Subscribe</>
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Subscribe for 0.5 SOL
                </>
              )}
            </Button>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-500">Subscription activated successfully!</p>
            </div>
          )}
        </Card>

        {/* Referral Rewards Info */}
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Referral Rewards System
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-background/80 rounded-lg">
                <p className="font-semibold text-primary mb-1">Tier 1: Direct Referrals</p>
                <p className="text-2xl font-bold mb-1">20% (0.10 SOL)</p>
                <p className="text-sm text-muted-foreground">
                  Earn when someone uses your referral code
                </p>
              </div>
              <div className="p-4 bg-background/80 rounded-lg">
                <p className="font-semibold text-secondary mb-1">Tier 2: Network Rewards</p>
                <p className="text-2xl font-bold mb-1">10% (0.05 SOL)</p>
                <p className="text-sm text-muted-foreground">
                  Earn when your referrals bring in new subscribers
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />
              How It Works
            </h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>Send 0.5 SOL to activate your premium subscription</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>Get instant access to all premium features</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>Share your referral code to earn SOL rewards</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                <span>Build your network for passive income</span>
              </li>
            </ol>
          </Card>

          {/* Payment Distribution */}
          <Card className="p-6 bg-muted/50">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment Distribution
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent Wallet (Platform)</span>
                <span className="font-medium">75% (0.375 SOL)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direct Referrer</span>
                <span className="font-medium text-primary">20% (0.10 SOL)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Referrer&apos;s Referrer</span>
                <span className="font-medium text-secondary">10% (0.05 SOL)</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>0.5 SOL</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-12 bg-muted rounded-lg max-w-sm mx-auto mb-4" />
            <div className="h-6 bg-muted rounded-lg max-w-md mx-auto" />
          </div>
        </div>
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  )
}