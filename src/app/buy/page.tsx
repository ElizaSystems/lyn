'use client'
import { useState } from 'react'
import { Coins, ExternalLink, Copy, ArrowRight, Shield, Zap, TrendingUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ComingSoonOverlay } from '@/components/coming-soon-overlay'

export default function BuyLYNPage() {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const tokenAddress = '0xLYN1234567890abcdef1234567890abcdef124f88'

  const copyAddress = () => {
    navigator.clipboard.writeText(tokenAddress)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const exchanges = [
    { name: 'Raydium', type: 'DEX', volume: '$2.4M', fee: '0.25%', url: '#' },
    { name: 'Jupiter', type: 'Aggregator', volume: '$1.8M', fee: '0.1%', url: '#' },
    { name: 'Orca', type: 'DEX', volume: '$892K', fee: '0.3%', url: '#' },
  ]

  const tokenInfo = [
    { label: 'Current Price', value: '$0.042', change: '+12.5%' },
    { label: 'Market Cap', value: '$4.2M', change: '+8.3%' },
    { label: '24h Volume', value: '$892K', change: '+23.1%' },
    { label: 'Circulating Supply', value: '100M LYN', change: null },
  ]

  return (
    <ComingSoonOverlay 
      title="Buy LYN Coming Soon"
      description="Purchase LYN tokens directly through our integrated exchange interface. Multiple payment methods, best prices, and secure transactions."
    >
      <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Coins className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Buy $LYN</h1>
            <p className="text-sm text-muted-foreground">Purchase LYN tokens from trusted exchanges</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Token Information</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Contract:</span>
            <code className="text-xs font-mono bg-card px-2 py-1 rounded">
              {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAddress}
              className="hover:bg-primary/10"
            >
              {copiedAddress ? 'Copied!' : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tokenInfo.map((info) => (
            <div key={info.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{info.label}</p>
              <p className="text-xl font-bold">{info.value}</p>
              {info.change && (
                <p className={`text-xs ${info.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {info.change}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl border border-border/50">
          <h2 className="text-lg font-semibold mb-4">How to Buy</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">1</span>
              </div>
              <div>
                <p className="font-medium">Get SOL</p>
                <p className="text-sm text-muted-foreground">Purchase SOL from any major exchange</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">2</span>
              </div>
              <div>
                <p className="font-medium">Connect Wallet</p>
                <p className="text-sm text-muted-foreground">Use Phantom, Solflare, or any Solana wallet</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">3</span>
              </div>
              <div>
                <p className="font-medium">Swap for LYN</p>
                <p className="text-sm text-muted-foreground">Use any DEX listed below to swap SOL for LYN</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">✓</span>
              </div>
              <div>
                <p className="font-medium">You&apos;re Done!</p>
                <p className="text-sm text-muted-foreground">LYN tokens will appear in your wallet</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-border/50">
          <h2 className="text-lg font-semibold mb-4">Available Exchanges</h2>
          <div className="space-y-3">
            {exchanges.map((exchange) => (
              <div key={exchange.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-card/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{exchange.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{exchange.type}</span>
                      <span>•</span>
                      <span>Vol: {exchange.volume}</span>
                      <span>•</span>
                      <span>Fee: {exchange.fee}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button className="w-full mt-4 bg-primary hover:bg-primary/90">
            Buy on Raydium
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-xl border border-border/50 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <p className="font-medium">Audited</p>
            <p className="text-xs text-muted-foreground">Contract verified by CertiK</p>
          </div>
        </div>
        
        <div className="glass-card p-4 rounded-xl border border-border/50 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-secondary" />
          <div>
            <p className="font-medium">Deflationary</p>
            <p className="text-xs text-muted-foreground">Monthly token burns</p>
          </div>
        </div>
        
        <div className="glass-card p-4 rounded-xl border border-border/50 flex items-center gap-3">
          <Coins className="w-8 h-8 text-green-500" />
          <div>
            <p className="font-medium">Utility</p>
            <p className="text-xs text-muted-foreground">Powers the LYN ecosystem</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl border border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Important Note</p>
            <p className="text-xs text-muted-foreground">
              Always verify the contract address before making any purchases. 
              Be cautious of scam tokens with similar names. 
              Only use official links and trusted exchanges.
            </p>
          </div>
        </div>
      </div>
      </div>
    </ComingSoonOverlay>
  )
}