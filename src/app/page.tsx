'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Shield, Bot, Zap, BarChart3, Wallet, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  const features = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Advanced Security",
      description: "AI-powered security monitoring with real-time threat detection and phishing protection."
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "AI Agent Assistant",
      description: "Intelligent automation for trading, staking, and portfolio management tasks."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Automated Tasks",
      description: "Set up custom workflows for price alerts, security scans, and trading strategies."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics & Insights",
      description: "Comprehensive portfolio tracking with detailed metrics and performance analysis."
    },
    {
      icon: <Wallet className="w-6 h-6" />,
      title: "Multi-Wallet Support",
      description: "Connect and manage multiple Solana wallets with unified interface."
    }
  ]

  const benefits = [
    "Real-time portfolio monitoring",
    "Automated security scanning", 
    "Smart trading assistance",
    "Custom alert system",
    "Advanced analytics dashboard"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-6">
        {/* Header */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="LYN AI" 
              width={40}
              height={40}
              className="rounded-lg object-cover"
            />
            <span className="text-xl font-bold">LYN AI</span>
          </div>
          <Link href="/dashboard">
            <Button className="bg-primary hover:bg-primary/90">
              Launch App
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </header>

        {/* Hero Section */}
        <section className="text-center py-20">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              AI-Powered Solana
              <br />
              Security Assistant
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              Revolutionize your crypto experience with advanced AI automation, 
              security monitoring, and intelligent portfolio management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-4">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/wallet">
                <Button size="lg" variant="outline" className="text-lg px-8 py-4 border-primary/30 hover:bg-primary/10">
                  View LYN&apos;s Wallet
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features for Smart Traders
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to trade smarter, safer, and more efficiently on Solana.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="glass-card p-6 rounded-xl border border-border/50 hover:border-primary/30 transition-all group">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Why Choose LYN AI?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Our advanced AI technology provides you with the tools and insights 
                needed to make informed decisions in the fast-paced crypto market.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="glass-card p-8 rounded-2xl border border-border/50">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Portfolio Value</span>
                    <span className="text-2xl font-bold text-green-500">+24.7%</span>
                  </div>
                  <div className="h-32 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg flex items-end justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Live Analytics</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">98.7%</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">24/7</p>
                      <p className="text-sm text-muted-foreground">Monitoring</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Start Trading Smarter?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of traders who trust LYN AI for their Solana trading needs.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-4">
                Launch Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/50 py-8 mt-20">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Image 
                src="/logo.png" 
                alt="LYN AI" 
                width={24}
                height={24}
                className="rounded object-cover"
              />
              <span className="font-semibold">LYN AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 LYN AI. Revolutionizing Solana trading with AI.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}