'use client'
import { useState } from 'react'
import { useWallet } from '@/components/solana/solana-provider'
import { useRouter } from 'next/navigation'
import { 
  Wallet, ArrowRight, CheckCircle2, User, Shield, Scan, 
  Trophy, Zap, Globe, Code, Users, Star, Lock, AlertCircle,
  ChevronRight, Rocket, Target, TrendingUp, Sparkles
} from 'lucide-react'

interface StepProps {
  number: number
  title: string
  description: string
  icon: React.ReactNode
  status: 'completed' | 'current' | 'upcoming'
  action?: {
    label: string
    onClick: () => void
  }
}

const Step = ({ number, title, description, icon, status, action }: StepProps) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'completed':
        return 'border-green-500/30 bg-green-500/10'
      case 'current':
        return 'border-primary/50 bg-primary/10 animate-pulse-subtle'
      case 'upcoming':
        return 'border-border/50 bg-muted/30 opacity-60'
      default:
        return 'border-border/50 bg-muted/30'
    }
  }

  const getNumberStyles = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'current':
        return 'bg-primary text-primary-foreground'
      case 'upcoming':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className={`p-6 rounded-xl border transition-all ${getStatusStyles()}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getNumberStyles()}`}>
          {status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : number}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {icon}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
          {action && status === 'current' && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
            >
              {action.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GetStartedPage() {
  const { connected, publicKey } = useWallet()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(connected ? 2 : 1)

  const getStepStatus = (stepNumber: number) => {
    if (stepNumber < currentStep) return 'completed'
    if (stepNumber === currentStep) return 'current'
    return 'upcoming'
  }

  const steps = [
    {
      number: 1,
      title: 'Connect Your Wallet',
      description: 'Connect your Solana wallet (Phantom, Solflare, etc.) to access the platform. Your wallet is your identity and gateway to all features.',
      icon: <Wallet className="w-5 h-5 text-primary" />,
      action: !connected ? {
        label: 'Connect Wallet',
        onClick: () => {
          // Wallet connection is handled by the wallet button in the header
          document.querySelector('[data-wallet-button]')?.click()
        }
      } : undefined
    },
    {
      number: 2,
      title: 'Register Your Username',
      description: 'Choose a unique username (3-20 characters) that will be permanently linked to your wallet. One-time fee: 0.01 SOL.',
      icon: <User className="w-5 h-5 text-primary" />,
      action: connected && !localStorage.getItem('username') ? {
        label: 'Register Username',
        onClick: () => router.push('/account')
      } : undefined
    },
    {
      number: 3,
      title: 'Explore Security Tools',
      description: 'Access our multi-type scanner to check URLs, wallets, smart contracts, and transactions for threats and vulnerabilities.',
      icon: <Shield className="w-5 h-5 text-primary" />,
      action: {
        label: 'Start Scanning',
        onClick: () => router.push('/scans')
      }
    },
    {
      number: 4,
      title: 'Build Your Reputation',
      description: 'Earn reputation points and badges by performing scans, detecting threats, and contributing to the community.',
      icon: <Trophy className="w-5 h-5 text-primary" />,
      action: {
        label: 'View Profile',
        onClick: () => router.push('/profile')
      }
    }
  ]

  const features = [
    {
      title: 'Security Scanner',
      description: 'Multi-type threat detection',
      icon: <Scan className="w-5 h-5" />,
      href: '/scans'
    },
    {
      title: 'Wallet Security',
      description: 'Deep wallet analysis',
      icon: <Shield className="w-5 h-5" />,
      href: '/wallet-security'
    },
    {
      title: 'Burn Tracker',
      description: 'Token deflation metrics',
      icon: <TrendingUp className="w-5 h-5" />,
      href: '/burn'
    },
    {
      title: 'Referral Program',
      description: '2-tier reward system',
      icon: <Users className="w-5 h-5" />,
      href: '/referral'
    },
    {
      title: 'Premium Plans',
      description: 'Enhanced features',
      icon: <Star className="w-5 h-5" />,
      href: '/subscription'
    },
    {
      title: 'Task Automation',
      description: 'Schedule security tasks',
      icon: <Zap className="w-5 h-5" />,
      href: '/tasks'
    }
  ]

  const guides = [
    {
      title: 'Security Best Practices',
      items: [
        'Scan new contracts before interaction',
        'Set up wallet monitoring alerts',
        'Report suspicious activity',
        'Check threat feed daily',
        'Verify all addresses and links'
      ]
    },
    {
      title: 'Earning Rewards',
      items: [
        'Complete daily security scans',
        'Detect and report threats',
        'Refer new users (2-tier system)',
        'Stake LYN tokens for APY',
        'Burn tokens for exclusive badges'
      ]
    },
    {
      title: 'Pro Tips',
      items: [
        'Build reputation early with daily scans',
        'Share referral code in crypto communities',
        'Focus on achievable badges first',
        'Use analytics to spot patterns',
        'Automate monitoring for critical wallets'
      ]
    }
  ]

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
              <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold">Get Started with LYN</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Your journey to Web3 security starts here</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-8 p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20">
          <div className="flex items-start gap-4">
            <Sparkles className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold mb-2">Welcome to LYN Security Platform</h2>
              <p className="text-sm text-muted-foreground mb-4">
                LYN is a comprehensive Web3 security platform built on Solana that protects users from scams, 
                malicious contracts, and threats across the blockchain ecosystem. Our platform combines advanced 
                threat detection, community-driven security, and innovative tokenomics.
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>20+ Security Features</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Real-time Threat Detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Community Rewards</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Getting Started Steps */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Quick Start Guide
          </h2>
          <div className="space-y-4">
            {steps.map((step) => (
              <Step
                key={step.number}
                {...step}
                status={getStepStatus(step.number)}
              />
            ))}
          </div>
        </div>

        {/* Core Features Grid */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Core Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <button
                key={feature.href}
                onClick={() => router.push(feature.href)}
                className="p-4 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-2" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Guides Section */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Code className="w-6 h-6 text-primary" />
            Essential Guides
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {guides.map((guide) => (
              <div key={guide.title} className="p-6 rounded-xl border border-border/50 bg-muted/30">
                <h3 className="font-semibold mb-4 text-primary">{guide.title}</h3>
                <ul className="space-y-2">
                  {guide.items.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Subscription */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Star className="w-6 h-6 text-primary" />
            Premium Subscription
          </h2>
          <div className="max-w-3xl mx-auto">
            <div className="p-6 rounded-xl border border-primary/50 bg-gradient-to-br from-primary/10 to-accent/10">
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">👑</div>
                <h3 className="text-2xl font-semibold mb-2">Premium Tier</h3>
                <p className="text-3xl font-bold text-primary">0.5 SOL<span className="text-sm text-muted-foreground">/month</span></p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Priority access to all features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Enhanced security scans</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Advanced analytics & insights</span>
                  </li>
                </ul>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Referral network benefits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Exclusive premium badge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Monthly bonus rewards</span>
                  </li>
                </ul>
              </div>

              {/* Referral Rewards Info */}
              <div className="p-4 bg-background/50 rounded-lg mb-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  2-Tier Referral Rewards
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-primary/10 rounded">
                    <p className="font-medium text-primary">Tier 1: Direct Referrals</p>
                    <p className="text-lg font-bold">10% (0.05 SOL)</p>
                    <p className="text-xs text-muted-foreground">Per subscription</p>
                  </div>
                  <div className="p-3 bg-secondary/10 rounded">
                    <p className="font-medium text-secondary">Tier 2: Network Rewards</p>
                    <p className="text-lg font-bold">5% (0.025 SOL)</p>
                    <p className="text-xs text-muted-foreground">From referral's referrals</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => router.push('/subscription')}
                  className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                >
                  Subscribe Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="mb-12 p-6 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-secondary mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get support through multiple channels to ensure you have the best experience on our platform.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium mb-2">Support Channels</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• In-app chat assistant (24/7)</li>
                    <li>• Community Discord</li>
                    <li>• Email: support@lyn.ai</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Resources</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Documentation & FAQs</li>
                    <li>• Video tutorials</li>
                    <li>• Security best practices</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Ready to Secure Your Web3 Journey?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust LYN to protect their crypto assets and navigate the 
            blockchain safely. Start with our free tier and upgrade as you grow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/scans')}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2 justify-center"
            >
              Start Scanning
              <Shield className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors inline-flex items-center gap-2 justify-center"
            >
              View Dashboard
              <Globe className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}