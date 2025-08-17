'use client'
import { TrendingUp, Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TradingPage() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 flex items-center justify-center">
          <TrendingUp className="w-10 h-10 text-secondary" />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold">Trading</h1>
            <span className="badge-cyan">Coming Soon</span>
          </div>
          <p className="text-muted-foreground">
            Advanced AI-powered trading features are being developed
          </p>
        </div>

        <div className="glass-card p-6 rounded-xl border border-border/50 space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="font-medium">AI Trading Bot</p>
              <p className="text-sm text-muted-foreground">Automated trading with machine learning</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-secondary" />
            <div className="text-left">
              <p className="font-medium">Smart Order Routing</p>
              <p className="text-sm text-muted-foreground">Best price execution across DEXs</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="font-medium">Risk Management</p>
              <p className="text-sm text-muted-foreground">AI-powered portfolio protection</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>Feature locked • Requires LYN token holding</span>
        </div>

        <Button className="bg-primary hover:bg-primary/90">
          Get Notified
        </Button>
      </div>
    </div>
  )
}