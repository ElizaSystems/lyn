'use client'
import { useState, useEffect } from 'react'
import { Map, Check, Clock, Calendar, Users, Code, Sparkles, Globe } from 'lucide-react'

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
      id: 'current',
      title: 'Core Platform Stabilization',
      description: 'Focus on stability, testing, and core security features that are already built',
      status: 'in-progress',
      quarter: 'Q3 2025',
      timeline: 'Aug - Sep 2025',
      features: [
        'Complete test suite coverage (85% → 95%)',
        'Performance optimization for existing features',
        'Bug fixes and stability improvements', 
        'Enhanced error handling and logging',
        'Mobile-responsive UI improvements'
      ],
      priority: 'high',
      effort: '6-8 weeks part-time'
    },
    {
      id: 'q4-2025',
      title: 'User Experience & Automation',
      description: 'Improve existing features and implement the automated task system',
      status: 'planned',
      quarter: 'Q4 2025',
      timeline: 'Oct - Dec 2025',
      features: [
        'Automated security scanning system',
        'Task scheduling and notifications',
        'Enhanced AI chat with conversation history',
        'Improved wallet integration and transaction tracking',
        'User settings and preferences system'
      ],
      priority: 'high',
      effort: '10-12 weeks part-time'
    },
    {
      id: 'q1-2026',
      title: 'Mobile & Browser Extensions',
      description: 'Expand platform reach with mobile support and browser extensions',
      status: 'planned',
      quarter: 'Q1 2026',
      timeline: 'Jan - Mar 2026',
      features: [
        'Progressive Web App (PWA) support',
        'Browser extension (Chrome/Firefox)',
        'Mobile-optimized interface',
        'Offline capability for basic features',
        'Push notifications system'
      ],
      priority: 'high',
      effort: '8-10 weeks part-time'
    },
    {
      id: 'q2-2026',
      title: 'Advanced Security & Analytics',
      description: 'Add sophisticated security analysis and improved analytics',
      status: 'planned',
      quarter: 'Q2 2026',
      timeline: 'Apr - Jun 2026',
      features: [
        'Enhanced smart contract analysis',
        'DeFi protocol risk assessment',
        'Advanced analytics dashboard',
        'Transaction pattern analysis',
        'Threat intelligence integration'
      ],
      priority: 'medium',
      effort: '10-12 weeks part-time'
    },
    {
      id: 'q3-2026',
      title: 'Community & API Platform',
      description: 'Build community features and developer API access',
      status: 'planned',
      quarter: 'Q3 2026',
      timeline: 'Jul - Sep 2026',
      features: [
        'Public API for developers',
        'Community threat sharing',
        'Integration marketplace',
        'Educational content system',
        'Advanced user analytics'
      ],
      priority: 'medium',
      effort: '8-10 weeks part-time'
    },
    {
      id: 'future',
      title: 'Enterprise & Ecosystem',
      description: 'Enterprise solutions and broader ecosystem integrations',
      status: 'planned',
      quarter: 'Q4 2026+',
      timeline: 'Oct 2026 & Beyond',
      features: [
        'Enterprise security dashboard',
        'Multi-language support',
        'Cross-chain compatibility',
        'White-label solutions',
        'AI model improvements'
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
              <p className="text-xs sm:text-sm text-muted-foreground">Fixed start: August 18, 2025</p>
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
              <h2 className="text-base sm:text-lg font-semibold mb-2">Team & Timeline Context</h2>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-1">Team Size</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">2-3 developers working part-time</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Current Date</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">{currentDate || 'Loading...'}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Development Approach</p>
                  <p className="text-muted-foreground text-xs sm:text-sm">Aggressive timeline, quality-focused delivery</p>
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
          {/* Development philosophy */}
          <div className="p-4 sm:p-6 bg-primary/5 rounded-xl border border-primary/20">
            <div className="flex items-start gap-3 sm:gap-4">
              <Code className="w-5 h-5 sm:w-6 sm:h-6 text-primary mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold mb-2 text-primary text-sm sm:text-base">Aggressive Development Philosophy</h3>
                <div className="space-y-2 text-xs sm:text-sm">
                  <p>• <strong>Fast Iteration:</strong> Rapid feature development with shorter release cycles</p>
                  <p>• <strong>MVP Approach:</strong> Launch features quickly and iterate based on user feedback</p>
                  <p>• <strong>User-Driven Priorities:</strong> Features prioritized based on user feedback and usage patterns</p>
                  <p>• <strong>Continuous Deployment:</strong> Regular releases with automated testing and monitoring</p>
                </div>
              </div>
            </div>
          </div>

          {/* Flexibility note */}
          <div className="p-4 sm:p-6 bg-muted/30 rounded-xl border border-border/50">
            <div className="flex items-start gap-3 sm:gap-4">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-secondary mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Fixed Timeline Commitment</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  This roadmap uses a fixed start date of August 18, 2025, regardless of when you&apos;re viewing it. 
                  Timelines are aggressive but achievable with focused part-time development. Features may be reprioritized 
                  based on community needs, but delivery dates remain target-focused.
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