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
      title: "AI Defense Agent",
      description: "Intelligent cyber defense agent protecting your crypto assets from threats and scams."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Automated Protection",
      description: "Set up custom security workflows for threat monitoring, wallet protection, and scam detection."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Security Analytics",
      description: "Comprehensive threat intelligence with detailed security metrics and risk analysis."
    },
    {
      icon: <Wallet className="w-6 h-6" />,
      title: "Multi-Wallet Protection",
      description: "Secure and monitor multiple Solana wallets with unified threat detection."
    }
  ]

  const benefits = [
    "Real-time threat monitoring",
    "Automated security scanning", 
    "Smart contract auditing",
    "Phishing detection system",
    "Advanced security dashboard"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Header */}
        <header className="flex items-center justify-between py-4 sm:py-6">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="LYN AI" 
              width={32}
              height={32}
              className="rounded-lg object-cover sm:w-10 sm:h-10"
            />
            <span className="text-lg sm:text-xl font-bold">LYN AI</span>
          </div>
          <Link href="/dashboard">
            <Button className="bg-primary hover:bg-primary/90 text-sm sm:text-base px-3 sm:px-4">
              <span className="hidden sm:inline">Launch App</span>
              <span className="sm:hidden">Launch</span>
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
            </Button>
          </Link>
        </header>

        {/* Hero Section */}
        <section className="text-center py-12 sm:py-16 lg:py-20">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              AI-Powered Crypto
              <br />
              Security Defense
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed px-2">
              Protect your crypto assets with advanced AI-powered cyber defense, 
              real-time threat detection, and intelligent security monitoring.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/wallet" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 border-primary/30 hover:bg-primary/10 w-full sm:w-auto">
                  View LYN&apos;s Wallet
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-12 sm:py-16 lg:py-20">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Powerful Security Features for Crypto Defense
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Everything you need to stay secure, protected, and informed in the crypto ecosystem.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-4">
            {features.map((feature, index) => (
              <div key={index} className="glass-card p-4 sm:p-6 rounded-xl border border-border/50 hover:border-primary/30 transition-all group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center px-4">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
                Why Choose LYN AI?
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
                Our advanced AI technology provides you with the defense and protection 
                needed to navigate the crypto ecosystem safely and securely.
              </p>
              <div className="space-y-3 sm:space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                    </div>
                    <span className="text-base sm:text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative mt-8 lg:mt-0">
              <div className="glass-card p-4 sm:p-6 lg:p-8 rounded-2xl border border-border/50">
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Portfolio Value</span>
                    <span className="text-lg sm:text-2xl font-bold text-green-500">+24.7%</span>
                  </div>
                  <div className="h-24 sm:h-32 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg flex items-end justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-primary" />
                      <p className="text-xs sm:text-sm text-muted-foreground">Live Analytics</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-lg sm:text-2xl font-bold">98.7%</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-2xl font-bold">24/7</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Monitoring</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 sm:py-16 lg:py-20 text-center">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
              Ready to Secure Your Crypto Assets?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 px-2">
              Join thousands of users who trust LYN AI for their crypto security needs.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4">
                Launch Dashboard
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/50 py-6 sm:py-8 mt-12 sm:mt-16 lg:mt-20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-2">
              <Image 
                src="/logo.png" 
                alt="LYN AI" 
                width={20}
                height={20}
                className="rounded object-cover sm:w-6 sm:h-6"
              />
              <span className="text-sm sm:text-base font-semibold">LYN AI</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center md:text-left">
              © 2025 LYN AI. Revolutionizing crypto security with AI-powered defense.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}