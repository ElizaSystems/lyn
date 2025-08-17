'use client'
import { useState } from 'react'
import { SecurityChat } from '@/components/security/security-chat'
import { Shield, Sparkles } from 'lucide-react'

export function DashboardFeature() {
  const [showChat, setShowChat] = useState(false)
  const [initialQuery, setInitialQuery] = useState('')

  const handleQuickAction = (query: string) => {
    setInitialQuery(query)
    setShowChat(true)
  }

  if (showChat) {
    return (
      <div className="h-full p-6">
        <SecurityChat initialMessage={initialQuery} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent opacity-20 blur-xl animate-pulse" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/logo.png" 
            alt="LYN AI Logo" 
            className="w-24 h-24 rounded-full object-cover relative z-10 shadow-2xl"
          />
          <Sparkles className="absolute top-0 right-0 w-8 h-8 text-primary drop-shadow-[0_0_10px_rgba(255,0,100,0.5)]" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Hey, I&apos;m LYN Security AI
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
            I protect you from phishing attacks and malicious documents 24/7. Powered by advanced AI, I analyze suspicious links, scan documents for malware, and keep your digital life secure.
          </p>
          <p className="text-sm text-muted-foreground">
            Want to know more? Check my <a href="/docs" className="text-primary hover:underline">security guide</a>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
          <button 
            onClick={() => handleQuickAction('I received a suspicious email with a link')}
            className="glass-card p-6 text-left hover:bg-card/70 transition-all rounded-xl group border border-border/50 hover:border-primary/30"
          >
            <p className="text-foreground/80 group-hover:text-foreground transition-colors">
              Check a suspicious link for phishing
            </p>
          </button>
          <button 
            onClick={() => handleQuickAction('I want to scan a document for malware')}
            className="glass-card p-6 text-left hover:bg-card/70 transition-all rounded-xl group border border-border/50 hover:border-primary/30"
          >
            <p className="text-foreground/80 group-hover:text-foreground transition-colors">
              Scan a document for malware
            </p>
          </button>
          <button 
            onClick={() => handleQuickAction('How do I identify phishing attempts?')}
            className="glass-card p-6 text-left hover:bg-card/70 transition-all rounded-xl group border border-border/50 hover:border-primary/30"
          >
            <p className="text-foreground/80 group-hover:text-foreground transition-colors">
              Learn about phishing protection
            </p>
          </button>
          <button 
            onClick={() => handleQuickAction('What are common online security threats?')}
            className="glass-card p-6 text-left hover:bg-card/70 transition-all rounded-xl group border border-border/50 hover:border-primary/30"
          >
            <p className="text-foreground/80 group-hover:text-foreground transition-colors">
              Explore security threats
            </p>
          </button>
        </div>

        <div className="mt-12">
          <button
            onClick={() => setShowChat(true)}
            className="w-full p-4 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30 rounded-xl text-foreground hover:from-primary/20 hover:to-secondary/20 transition-all flex items-center justify-center gap-2 group"
          >
            <Shield className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            <span>Start Security Assistant</span>
            <Sparkles className="w-4 h-4 text-secondary" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            AI Protection Active
          </span>
          <span>•</span>
          <span>Your security is our priority</span>
        </div>
      </div>
    </div>
  )
}
