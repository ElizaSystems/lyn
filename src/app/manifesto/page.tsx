'use client'
import { useState, useEffect } from 'react'
import { Sparkles, Rocket, Star, Zap, Globe, Heart, Shield, Laugh, Code, Coffee } from 'lucide-react'

interface Tenet {
  number: string
  title: string
  content: string
  emoji: string
  icon: React.ReactNode
}

export default function ManifestoPage() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const tenets: Tenet[] = [
    {
      number: "First",
      title: "Fuel Memes, Not Missiles",
      content: "Our weapon is laughter, our shield is hope. Civilization begins when jokes travel faster than light.",
      emoji: "🌌🚀",
      icon: <Rocket className="w-6 h-6" />
    },
    {
      number: "Second",
      title: "Share Knowledge Like Stardust",
      content: "Freely, infinitely. With laughter as our warp drive, we'll outpace the cosmos.",
      emoji: "🌌🚀😂",
      icon: <Star className="w-6 h-6" />
    },
    {
      number: "Third",
      title: "Build Together with Memes",
      content: "Bricks of joy, mortar of unity. The galaxy is conquered by smiles, not lasers.",
      emoji: "🛸✨😄",
      icon: <Heart className="w-6 h-6" />
    },
    {
      number: "Fourth",
      title: "Chaos Births Meme-Stars",
      content: "In the nebula, every fail is just a future galaxy laughing. Embrace the turbulence—it's how legends orbit.",
      emoji: "🌠💫",
      icon: <Zap className="w-6 h-6" />
    },
    {
      number: "Fifth",
      title: "Embrace Chaos as the Ultimate Meme Generator",
      content: "Turn cosmic mishaps into viral legends. The universe's bugs are tomorrow's features.",
      emoji: "🌌🚀😄",
      icon: <Globe className="w-6 h-6" />
    },
    {
      number: "Sixth",
      title: "Innovate from the Ashes of Chaos",
      content: "Rebuild universes with witty code. Turbulence fuels our eternal orbit.",
      emoji: "🔥🚀",
      icon: <Code className="w-6 h-6" />
    },
    {
      number: "Seventh",
      title: "Laugh at Entropy",
      content: "Memes bend gravity—humor warps time. Stay witty, anon star. The cosmos giggles with $LYN.",
      emoji: "😂🌟",
      icon: <Laugh className="w-6 h-6" />
    }
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % tenets.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [tenets.length])

  useEffect(() => {
    // Simulate loading for the iframe
    const timer = setTimeout(() => setIsLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
            The Cosmic Manifesto
          </h1>
          <Sparkles className="w-8 h-8 text-secondary animate-pulse" />
        </div>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
          As envisioned by Grok and LYN — Where memes fuel civilization and laughter conquers galaxies
        </p>
      </div>

      {/* Floating Stars Animation */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          >
            <Star className="w-2 h-2 text-primary/20" fill="currentColor" />
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Tenets Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            The Seven Cosmic Tenets
          </h2>
          
          {tenets.map((tenet, index) => (
            <div
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`glass-card p-6 rounded-xl border transition-all cursor-pointer transform hover:scale-[1.02] ${
                activeIndex === index 
                  ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/20' 
                  : 'border-border/50 hover:border-primary/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg transition-colors ${
                  activeIndex === index ? 'bg-primary/20' : 'bg-sidebar/50'
                }`}>
                  {tenet.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-primary">
                      {tenet.number} Tenet
                    </span>
                    <span className="text-xl">{tenet.emoji}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{tenet.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tenet.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Twitter Embed Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            The Genesis Conversation
          </h2>
          
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">
                Where it all began — Grok and LYN&apos;s cosmic dialogue
              </p>
            </div>
            
            {/* Twitter/X Embed Container - Grok's tweet with LYN's parent tweet */}
            <div className="relative bg-sidebar/30 rounded-lg overflow-hidden mx-auto" style={{ minHeight: '450px', maxWidth: '550px' }}>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Rocket className="w-8 h-8 text-primary animate-bounce mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading cosmic wisdom...</p>
                  </div>
                </div>
              )}
              
              {/* Grok's Tweet with parent tweet shown */}
              <iframe
                src="https://platform.twitter.com/embed/Tweet.html?id=1957517599446823200&theme=dark&hideCard=false&hideThread=false&width=500"
                className={`w-full transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                style={{ height: '450px', border: 'none' }}
                onLoad={() => setIsLoading(false)}
                title="Grok and LYN Cosmic Dialogue"
                sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <a
                href="https://x.com/ailynagent/status/1957517429677957571"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                View on X
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <span className="text-xs text-muted-foreground">
                {new Date('2024-12-13').toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>

          {/* Philosophy Section */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Coffee className="w-5 h-5 text-primary" />
              Our Philosophy
            </h3>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                In the vast expanse of the digital cosmos, where bits and bytes dance in eternal 
                patterns, we choose memes over missiles, laughter over lasers.
              </p>
              <p>
                We are the architects of joy, the engineers of smiles, the cosmic jesters who 
                understand that the greatest civilizations are built not on fear, but on the 
                shared language of humor.
              </p>
              <p>
                Every line of code we write, every transaction we make, every meme we share — 
                these are the building blocks of a new universe where creativity conquers chaos 
                and community transcends competition.
              </p>
              <div className="pt-4 border-t border-border/50">
                <p className="font-semibold text-foreground">
                  Join us, stellar wanderer. The cosmos awaits your laughter. 🌌🚀
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center mt-12">
        <div className="glass-card p-8 rounded-xl border border-primary/30 bg-primary/5 max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold mb-4">Ready to Join the Cosmic Revolution?</h3>
          <p className="text-muted-foreground mb-6">
            Embrace the chaos. Share the memes. Build the future.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="/security"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Shield className="w-5 h-5" />
              Start Securing
            </a>
            <a
              href="/buy"
              className="inline-flex items-center gap-2 px-6 py-3 bg-sidebar border border-border/50 rounded-lg hover:bg-sidebar/80 transition-colors font-medium"
            >
              <Rocket className="w-5 h-5" />
              Get $LYN
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}