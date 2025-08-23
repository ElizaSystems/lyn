'use client'
import { useState, useEffect } from 'react'
import { Map, Check, Clock, Calendar, Users, Globe } from 'lucide-react'

interface RoadmapItem {
  id: string
  title: string
  description: string
  status: 'completed' | 'in-progress' | 'planned'
  quarter: string
  timeline: string
  features: string[]
  priority: 'high' | 'medium' | 'low'
  effort: string
}

export default function RoadmapPage() {
  const [currentDate, setCurrentDate] = useState('')

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }))
  }, [])

  const roadmapItems: RoadmapItem[] = [
    {
      id: 'completed-phase-1',
      title: 'Platform Foundation & Core Features',
      description: 'Essential security features, user system, and blockchain integration',
      status: 'completed',
      quarter: 'Q4 2024',
      timeline: 'Oct - Dec 2024',
      features: [
        '✅ Multi-type security scanner (URL, wallet, contract, transaction)',
        '✅ User registration and profile system',
        '✅ Wallet authentication and connection',
        '✅ Real-time threat intelligence dashboard',
        '✅ Basic security chat assistant',
        '✅ Mobile-responsive design implementation'
      ],
      priority: 'high',
      effort: 'Completed'
    },
    {
      id: 'completed-phase-2',
      title: 'Community & Monetization Features',
      description: 'Engagement systems, token economy, and revenue generation',
      status: 'completed',
      quarter: 'Q4 2024',
      timeline: 'Nov - Dec 2024',
      features: [
        '✅ Dynamic badge and achievement system',
        '✅ Reputation scoring with multiple factors',
        '✅ 2-tier referral rewards program',
        '✅ SOL-based premium subscriptions (Bronze/Silver/Gold)',
        '✅ Token burn tracking and leaderboard',
        '✅ Admin panel with wallet authentication',
        '✅ Platform metrics and analytics dashboard'
      ],
      priority: 'high',
      effort: 'Completed'
    },
    {
      id: 'current',
      title: 'Security API Integration & Testing',
      description: 'Connect real security APIs and comprehensive testing',
      status: 'in-progress',
      quarter: 'Q1 2025',
      timeline: 'Jan - Feb 2025',
      features: [
        '🔄 Integrate VirusTotal API for malware scanning',
        '🔄 Connect Google Safe Browsing API',
        '🔄 Implement URLVoid and PhishTank APIs',
        '⏳ Complete test suite coverage (current: ~40%)',
        '⏳ Performance optimization and caching',
        '⏳ Enhanced error handling for API failures'
      ],
      priority: 'high',
      effort: '4-6 weeks part-time'
    },
    {
      id: 'q2-2025',
      title: 'Voice Integration & Enhanced UX',
      description: 'ElevenLabs voice features and user experience improvements',
      status: 'planned',
      quarter: 'Q2 2025',
      timeline: 'Mar - Apr 2025',
      features: [
        '🎤 Voice-to-text input using Web Speech API',
        '🔊 Text-to-voice responses with ElevenLabs',
        '🎧 Real-time voice-to-voice conversation mode',
        '⚙️ Voice preferences and settings (voice selection, speed, language)',
        'Automated task system implementation',
        'Enhanced AI chat with conversation history',
        'Webhook and email notifications'
      ],
      priority: 'high',
      effort: '8-10 weeks part-time'
    },
    {
      id: 'q3-2025',
      title: 'Advanced Security Features',
      description: 'Sophisticated threat detection and analysis tools',
      status: 'planned',
      quarter: 'Q3 2025',
      timeline: 'May - Jun 2025',
      features: [
        'Smart contract vulnerability scanner',
        'DeFi protocol risk assessment',
        'Transaction pattern analysis',
        'Cross-chain wallet tracking',
        'Custom alert conditions',
        'Security report generation (PDF export)'
      ],
      priority: 'high',
      effort: '8-10 weeks part-time'
    },
    {
      id: 'q4-2025',
      title: 'Mobile & Browser Extensions',
      description: 'Expand platform reach with mobile and browser integration',
      status: 'planned',
      quarter: 'Q4 2025',
      timeline: 'Jul - Sep 2025',
      features: [
        'Progressive Web App (PWA) development',
        'Chrome extension for real-time protection',
        'Firefox extension support',
        'Mobile app prototypes (iOS/Android)',
        'Push notifications system',
        'Offline scanning capabilities'
      ],
      priority: 'medium',
      effort: '10-12 weeks part-time'
    },
    {
      id: 'q1-2026',
      title: 'Community Platform & API',
      description: 'Developer tools and community-driven security',
      status: 'planned',
      quarter: 'Q1 2026',
      timeline: 'Oct - Dec 2025',
      features: [
        'Public REST API for developers',
        'API documentation and SDK',
        'Community threat reporting system',
        'Decentralized threat intelligence network',
        'Bug bounty program launch',
        'Educational content platform'
      ],
      priority: 'medium',
      effort: '8-10 weeks part-time'
    },
    {
      id: 'q2-2026',
      title: 'Cross-Chain & Enterprise',
      description: 'Multi-chain support and enterprise features',
      status: 'planned',
      quarter: 'Q2 2026',
      timeline: 'Jan - Mar 2026',
      features: [
        'Ethereum chain integration',
        'BSC and Polygon support',
        'Enterprise dashboard and APIs',
        'White-label solutions',
        'Advanced compliance tools',
        'Multi-language support (5+ languages)'
      ],
      priority: 'medium',
      effort: '12-14 weeks part-time'
    },
    {
      id: 'future',
      title: 'Long-Term Vision',
      description: 'DAO governance and advanced AI features',
      status: 'planned',
      quarter: 'Q3 2026+',
      timeline: 'Apr 2026 & Beyond',
      features: [
        'DAO governance implementation',
        'Smart contract insurance products',
        'NFT security verification system',
        'AI model fine-tuning and improvements',
        'Integration marketplace expansion',
        'Global security network scaling'
      ],
      priority: 'low',
      effort: 'Ongoing development'
    }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-500" />
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-500" />
      case 'planned':
        return <Calendar className="w-5 h-5 text-muted-foreground" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500/30 bg-green-500/10'
      case 'in-progress':
        return 'border-blue-500/30 bg-blue-500/10'
      case 'planned':
        return 'border-border/50 bg-muted/30'
      default:
        return 'border-border/50'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500 bg-red-500/10 border-red-500/30'
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
      case 'low':
        return 'text-green-500 bg-green-500/10 border-green-500/30'
      default:
        return 'text-muted-foreground bg-muted/30 border-border/30'
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
              <Map className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold">Development Roadmap</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Project launched: October 2024 | Last updated: {currentDate || 'Loading...'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Team Context */}
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-start gap-3 sm:gap-4">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary mt-1 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold mb-2">Project Status & Context</h2>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-1">Completion Status</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">Core platform: ✅ Complete | Security APIs: 🔄 In Progress</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Features Delivered</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">20+ major features including scanners, subscriptions, referrals, and badges</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Next Milestone</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">Real security API integration and comprehensive testing suite</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap Timeline */}
        <div className="space-y-6 sm:space-y-8">
          {roadmapItems.map((item, index) => (
            <div key={item.id} className="relative">
              {/* Timeline line */}
              {index < roadmapItems.length - 1 && (
                <div className="absolute left-4 sm:left-6 top-12 sm:top-16 w-0.5 h-full bg-border/50" />
              )}
              
              {/* Roadmap item */}
              <div className={`glass-card p-4 sm:p-6 rounded-xl border ${getStatusColor(item.status)} relative`}>
                {/* Status indicator */}
                <div className="absolute -left-2 sm:-left-3 top-4 sm:top-6 w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-background border-2 border-current flex items-center justify-center">
                  {getStatusIcon(item.status)}
                </div>
                
                <div className="ml-6 sm:ml-8">
                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-lg sm:text-xl font-semibold">{item.title}</h3>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getPriorityColor(item.priority)} self-start`}>
                        {item.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">{item.description}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm">
                      <span className="font-medium text-primary">{item.quarter}</span>
                      <span className="text-muted-foreground">{item.timeline}</span>
                      <span className="text-muted-foreground">{item.effort}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="font-medium mb-3 text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
                      Key Features & Improvements
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {item.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start gap-2 text-xs sm:text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <span className="break-words">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer notes */}
        <div className="mt-8 sm:mt-12 space-y-4 sm:space-y-6">
          {/* Current Progress */}
          <div className="p-4 sm:p-6 bg-green-500/5 rounded-xl border border-green-500/20">
            <div className="flex items-start gap-3 sm:gap-4">
              <Check className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold mb-2 text-green-500 text-sm sm:text-base">Major Achievements</h3>
                <div className="space-y-2 text-xs sm:text-sm">
                  <p>• <strong>Platform Launch:</strong> Successfully deployed with 20+ features</p>
                  <p>• <strong>User System:</strong> Complete authentication, profiles, and reputation</p>
                  <p>• <strong>Monetization:</strong> Subscriptions, referrals, and burn mechanisms live</p>
                  <p>• <strong>Security Core:</strong> Multi-type scanner and threat detection operational</p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="p-4 sm:p-6 bg-blue-500/5 rounded-xl border border-blue-500/20">
            <div className="flex items-start gap-3 sm:gap-4">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold mb-2 text-blue-500 text-sm sm:text-base">Current Focus (Q1 2025)</h3>
                <p className="text-xs sm:text-sm">
                  We&apos;re currently integrating real security APIs including VirusTotal, Google Safe Browsing, 
                  and PhishTank to enhance threat detection accuracy. Additionally, we&apos;re building comprehensive 
                  test coverage and optimizing performance for scale.
                </p>
              </div>
            </div>
          </div>

          {/* Community involvement */}
          <div className="p-4 sm:p-6 bg-secondary/5 rounded-xl border border-secondary/20">
            <div className="flex items-start gap-3 sm:gap-4">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-secondary mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold mb-2 text-secondary text-sm sm:text-base">Community Feedback Welcome</h3>
                <p className="text-xs sm:text-sm">
                  We value community input on feature priorities and development direction. 
                  Join our Discord or submit feedback through our GitHub repository to help shape the future of LYN AI.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}