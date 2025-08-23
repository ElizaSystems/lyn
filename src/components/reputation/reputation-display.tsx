'use client'

import React from 'react'
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, Crown, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ReputationTier {
  tier: string
  minReputation: number
  maxReputation: number
  title: string
  description: string
  color: string
  benefits: string[]
  multiplier: number
}

interface ReputationDisplayProps {
  currentReputation: number
  tier: ReputationTier
  nextTier?: ReputationTier
  progressToNext?: number
  reputationChange?: {
    amount: number
    timeframe: string
  }
  decayInfo?: {
    isActive: boolean
    daysSinceLastActivity: number
    projectedDecay: number
    nextDecayCheck?: Date
  }
  multiplier: number
  totalEarned?: number
  showDetailed?: boolean
}

const TIER_ICONS = {
  novice: Shield,
  contributor: TrendingUp,
  guardian: Shield,
  expert: Trophy,
  elite: Crown,
  legend: Crown
}

const TIER_COLORS = {
  novice: '#9CA3AF',
  contributor: '#10B981',
  guardian: '#3B82F6',
  expert: '#8B5CF6',
  elite: '#F59E0B',
  legend: '#EF4444'
}

export function ReputationDisplay({
  currentReputation,
  tier,
  nextTier,
  progressToNext = 0,
  reputationChange,
  decayInfo,
  multiplier,
  totalEarned,
  showDetailed = false
}: ReputationDisplayProps) {
  const TierIcon = TIER_ICONS[tier.tier as keyof typeof TIER_ICONS] || Shield
  const tierColor = TIER_COLORS[tier.tier as keyof typeof TIER_COLORS] || '#9CA3AF'

  return (
    <div className="space-y-4">
      {/* Main reputation display */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3">
            <div 
              className="p-2 rounded-full"
              style={{ backgroundColor: `${tierColor}20`, color: tierColor }}
            >
              <TierIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{currentReputation.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Reputation Points</div>
            </div>
            <div className="ml-auto text-right">
              <Badge 
                variant="outline" 
                className="font-medium"
                style={{ borderColor: tierColor, color: tierColor }}
              >
                {tier.title}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">
                {multiplier.toFixed(1)}x bonus
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier description */}
          <p className="text-sm text-muted-foreground">
            {tier.description}
          </p>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress to {nextTier.title}</span>
                <span>
                  {currentReputation} / {nextTier.minReputation}
                </span>
              </div>
              <Progress value={progressToNext} className="h-2" />
              <div className="text-xs text-center text-muted-foreground">
                {(nextTier.minReputation - currentReputation).toLocaleString()} reputation needed
              </div>
            </div>
          )}

          {/* Reputation change indicator */}
          {reputationChange && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
              {reputationChange.amount > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                reputationChange.amount > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {reputationChange.amount > 0 ? '+' : ''}{reputationChange.amount} {reputationChange.timeframe}
              </span>
            </div>
          )}

          {/* Decay warning */}
          {decayInfo?.isActive && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-50 border border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <div className="text-sm">
                <span className="font-medium text-yellow-800">Reputation Decay Active</span>
                <div className="text-yellow-600">
                  {decayInfo.daysSinceLastActivity} days inactive • 
                  {decayInfo.projectedDecay > 0 && ` ${decayInfo.projectedDecay} reputation at risk`}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed breakdown */}
      {showDetailed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tier benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tier Benefits</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {tier.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    {benefit}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Reputation</span>
                <span className="font-medium">{currentReputation.toLocaleString()}</span>
              </div>
              
              {totalEarned && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Earned</span>
                  <span className="font-medium">{totalEarned.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Earning Multiplier</span>
                <span className="font-medium">{multiplier.toFixed(1)}x</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tier Range</span>
                <span className="font-medium">
                  {tier.minReputation.toLocaleString()} - {tier.maxReputation === Infinity ? '∞' : tier.maxReputation.toLocaleString()}
                </span>
              </div>
              
              {decayInfo && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Since Activity</span>
                  <span className="font-medium">{decayInfo.daysSinceLastActivity}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

interface ReputationHistoryProps {
  history: Array<{
    date: Date
    change: number
    reason: string
    newTotal: number
  }>
}

export function ReputationHistory({ history }: ReputationHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reputation History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reputation changes recorded yet.
            </p>
          ) : (
            history.map((entry, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  entry.change > 0 ? 'bg-green-500' : entry.change < 0 ? 'bg-red-500' : 'bg-gray-400'
                }`}></div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {entry.reason}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.date.toLocaleDateString()}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    entry.change > 0 ? 'text-green-600' : entry.change < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {entry.change > 0 ? '+' : ''}{entry.change}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.newTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface CompactReputationDisplayProps {
  currentReputation: number
  tier: ReputationTier
  multiplier: number
  size?: 'sm' | 'md'
  showTooltip?: boolean
}

export function CompactReputationDisplay({
  currentReputation,
  tier,
  multiplier,
  size = 'md',
  showTooltip = true
}: CompactReputationDisplayProps) {
  const TierIcon = TIER_ICONS[tier.tier as keyof typeof TIER_ICONS] || Shield
  const tierColor = TIER_COLORS[tier.tier as keyof typeof TIER_COLORS] || '#9CA3AF'
  
  const sizeClasses = {
    sm: 'text-xs p-1.5 gap-1.5',
    md: 'text-sm p-2 gap-2'
  }

  const content = (
    <div 
      className={`inline-flex items-center rounded-full border ${sizeClasses[size]}`}
      style={{ borderColor: tierColor }}
    >
      <TierIcon 
        className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}
        style={{ color: tierColor }}
      />
      <span className="font-medium">{currentReputation.toLocaleString()}</span>
      <Badge variant="outline" className="text-xs">
        {tier.title}
      </Badge>
    </div>
  )

  if (!showTooltip) {
    return content
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-semibold">{tier.title}</div>
            <div className="text-sm">{currentReputation.toLocaleString()} reputation</div>
            <div className="text-xs text-muted-foreground">
              {multiplier.toFixed(1)}x earning multiplier
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface TierProgressBarProps {
  tiers: ReputationTier[]
  currentReputation: number
  currentTier: ReputationTier
}

export function TierProgressBar({ tiers, currentReputation, currentTier }: TierProgressBarProps) {
  const maxReputation = Math.max(...tiers.filter(t => t.maxReputation !== Infinity).map(t => t.maxReputation))
  const displayMax = maxReputation > 0 ? maxReputation : 2000 // Fallback if all tiers are infinite

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reputation Tier Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall progress bar */}
          <div className="relative">
            <Progress 
              value={(currentReputation / displayMax) * 100} 
              className="h-3"
            />
            <div 
              className="absolute top-0 w-2 h-3 bg-white border border-gray-300 rounded-sm"
              style={{ left: `${Math.min((currentReputation / displayMax) * 100, 100)}%` }}
            />
          </div>

          {/* Tier markers */}
          <div className="space-y-2">
            {tiers.map((tier) => {
              const isCurrentTier = tier.tier === currentTier.tier
              const isPassed = currentReputation >= tier.minReputation
              const TierIcon = TIER_ICONS[tier.tier as keyof typeof TIER_ICONS] || Shield
              const tierColor = TIER_COLORS[tier.tier as keyof typeof TIER_COLORS] || '#9CA3AF'

              return (
                <div key={tier.tier} className={`flex items-center gap-3 p-2 rounded-md ${
                  isCurrentTier ? 'bg-muted border' : isPassed ? 'opacity-75' : 'opacity-50'
                }`}>
                  <TierIcon 
                    className="w-4 h-4" 
                    style={{ color: isPassed ? tierColor : '#9CA3AF' }}
                  />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${isCurrentTier ? 'text-primary' : ''}`}>
                      {tier.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tier.minReputation.toLocaleString()}{tier.maxReputation !== Infinity ? ` - ${tier.maxReputation.toLocaleString()}` : '+'} reputation
                    </div>
                  </div>
                  {isCurrentTier && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                  {isPassed && !isCurrentTier && (
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}