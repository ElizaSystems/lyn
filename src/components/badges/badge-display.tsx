'use client'

import React from 'react'
import { Badge, Star, Trophy, Award, Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface BadgeProps {
  key: string
  name: string
  description: string
  category: string
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'platinum'
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  emoji: string
  isEarned?: boolean
  earnedAt?: Date
  progress?: {
    current: number
    target: number
    percentage: number
  }
  visual?: {
    color: string
    borderColor?: string
    glowEffect?: boolean
    animationType?: 'pulse' | 'glow' | 'sparkle' | 'none'
  }
}

// Tier configurations with colors and effects
const TIER_CONFIG = {
  bronze: {
    color: '#CD7F32',
    borderColor: '#A0622A',
    glowColor: '#CD7F32',
    textColor: '#FFFFFF',
    icon: Badge
  },
  silver: {
    color: '#C0C0C0',
    borderColor: '#A0A0A0',
    glowColor: '#C0C0C0',
    textColor: '#000000',
    icon: Star
  },
  gold: {
    color: '#FFD700',
    borderColor: '#E6C200',
    glowColor: '#FFD700',
    textColor: '#000000',
    icon: Trophy
  },
  diamond: {
    color: '#B9F2FF',
    borderColor: '#87CEEB',
    glowColor: '#B9F2FF',
    textColor: '#000000',
    icon: Award
  },
  platinum: {
    color: '#E5E4E2',
    borderColor: '#D3D3D3',
    glowColor: '#E5E4E2',
    textColor: '#000000',
    icon: Crown
  }
}

const RARITY_CONFIG = {
  common: { glow: false, sparkle: false, borderWidth: 2 },
  uncommon: { glow: true, sparkle: false, borderWidth: 2 },
  rare: { glow: true, sparkle: true, borderWidth: 3 },
  epic: { glow: true, sparkle: true, borderWidth: 3 },
  legendary: { glow: true, sparkle: true, borderWidth: 4 }
}

interface SingleBadgeDisplayProps {
  badge: BadgeProps
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
  interactive?: boolean
}

export function SingleBadgeDisplay({ 
  badge, 
  size = 'md', 
  showProgress = false, 
  interactive = true 
}: SingleBadgeDisplayProps) {
  const tierConfig = TIER_CONFIG[badge.tier]
  const rarityConfig = RARITY_CONFIG[badge.rarity]
  const TierIcon = tierConfig.icon
  
  const sizeClasses = {
    sm: 'w-16 h-16 text-xs',
    md: 'w-24 h-24 text-sm',
    lg: 'w-32 h-32 text-base'
  }

  const badgeContent = (
    <div className="relative">
      <div 
        className={`
          ${sizeClasses[size]} 
          rounded-full border-${rarityConfig.borderWidth} 
          flex flex-col items-center justify-center 
          transition-all duration-300
          ${badge.isEarned ? 'opacity-100' : 'opacity-50 grayscale'}
          ${interactive ? 'hover:scale-105 cursor-pointer' : ''}
          ${rarityConfig.glow && badge.isEarned ? 'shadow-lg' : ''}
        `}
        style={{
          backgroundColor: badge.isEarned ? tierConfig.color : '#6B7280',
          borderColor: badge.isEarned ? tierConfig.borderColor : '#4B5563',
          color: badge.isEarned ? tierConfig.textColor : '#FFFFFF',
          ...(rarityConfig.glow && badge.isEarned && {
            boxShadow: `0 0 20px ${tierConfig.glowColor}33`
          })
        }}
      >
        {/* Badge emoji/icon */}
        <div className="text-2xl mb-1">
          {badge.emoji}
        </div>
        
        {/* Tier icon */}
        <TierIcon 
          className={`w-3 h-3 ${size === 'lg' ? 'w-4 h-4' : ''}`}
          style={{ color: tierConfig.textColor }}
        />
        
        {/* Sparkle effect for high rarity badges */}
        {rarityConfig.sparkle && badge.isEarned && (
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="absolute top-1 right-1 w-2 h-2 bg-yellow-300 rounded-full animate-pulse"
              style={{ animationDelay: '0s' }}
            />
            <div 
              className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse"
              style={{ animationDelay: '1s' }}
            />
            <div 
              className="absolute top-1/2 left-1 w-1 h-1 bg-yellow-300 rounded-full animate-pulse"
              style={{ animationDelay: '2s' }}
            />
          </div>
        )}
      </div>
      
      {/* Progress indicator */}
      {showProgress && badge.progress && !badge.isEarned && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-full">
          <Progress 
            value={badge.progress.percentage} 
            className="h-1 w-full"
          />
        </div>
      )}
      
      {/* Earned indicator */}
      {badge.isEarned && badge.earnedAt && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
      )}
    </div>
  )

  if (!interactive) {
    return badgeContent
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{badge.emoji}</span>
              <div>
                <div className="font-semibold">{badge.name}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {badge.tier} • {badge.rarity} • {badge.category}
                </div>
              </div>
            </div>
            
            <div className="text-sm">{badge.description}</div>
            
            {badge.progress && !badge.isEarned && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span>{badge.progress.current} / {badge.progress.target}</span>
                </div>
                <Progress value={badge.progress.percentage} className="h-2" />
                <div className="text-xs text-center text-muted-foreground">
                  {badge.progress.percentage.toFixed(0)}% complete
                </div>
              </div>
            )}
            
            {badge.isEarned && badge.earnedAt && (
              <div className="text-xs text-green-600">
                Earned {new Date(badge.earnedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface BadgeGridProps {
  badges: BadgeProps[]
  columns?: 4 | 6 | 8
  showProgress?: boolean
  filterByCategory?: string
  filterByTier?: string
  sortBy?: 'name' | 'tier' | 'rarity' | 'earnedAt' | 'progress'
}

export function BadgeGrid({ 
  badges, 
  columns = 6, 
  showProgress = false,
  filterByCategory,
  filterByTier,
  sortBy = 'tier'
}: BadgeGridProps) {
  // Filter badges
  let filteredBadges = badges
  if (filterByCategory) {
    filteredBadges = filteredBadges.filter(badge => badge.category === filterByCategory)
  }
  if (filterByTier) {
    filteredBadges = filteredBadges.filter(badge => badge.tier === filterByTier)
  }

  // Sort badges
  filteredBadges = [...filteredBadges].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'tier':
        const tierOrder = ['bronze', 'silver', 'gold', 'diamond', 'platinum']
        return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
      case 'rarity':
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary']
        return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
      case 'earnedAt':
        if (!a.earnedAt && !b.earnedAt) return 0
        if (!a.earnedAt) return 1
        if (!b.earnedAt) return -1
        return new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()
      case 'progress':
        const aProgress = a.progress?.percentage || (a.isEarned ? 100 : 0)
        const bProgress = b.progress?.percentage || (b.isEarned ? 100 : 0)
        return bProgress - aProgress
      default:
        return 0
    }
  })

  const gridCols = {
    4: 'grid-cols-4',
    6: 'grid-cols-6',
    8: 'grid-cols-8'
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4 p-4`}>
      {filteredBadges.map((badge) => (
        <div key={badge.key} className="flex flex-col items-center space-y-2">
          <SingleBadgeDisplay 
            badge={badge} 
            showProgress={showProgress}
            size="md"
          />
          <div className="text-xs text-center text-muted-foreground max-w-20 truncate">
            {badge.name}
          </div>
        </div>
      ))}
    </div>
  )
}

interface BadgeShowcaseProps {
  badge: BadgeProps
}

export function BadgeShowcase({ badge }: BadgeShowcaseProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {/* Large badge display */}
          <SingleBadgeDisplay 
            badge={badge} 
            size="lg" 
            interactive={false}
          />
          
          {/* Badge info */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold flex items-center gap-2 justify-center">
              <span>{badge.emoji}</span>
              {badge.name}
            </h3>
            
            <div className="text-sm text-muted-foreground">
              {badge.description}
            </div>
            
            <div className="flex gap-2 justify-center">
              <span className={`
                px-2 py-1 rounded text-xs font-medium
                ${badge.tier === 'bronze' ? 'bg-orange-100 text-orange-800' : ''}
                ${badge.tier === 'silver' ? 'bg-gray-100 text-gray-800' : ''}
                ${badge.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${badge.tier === 'diamond' ? 'bg-blue-100 text-blue-800' : ''}
                ${badge.tier === 'platinum' ? 'bg-purple-100 text-purple-800' : ''}
              `}>
                {badge.tier.charAt(0).toUpperCase() + badge.tier.slice(1)}
              </span>
              
              <span className={`
                px-2 py-1 rounded text-xs font-medium
                ${badge.rarity === 'common' ? 'bg-gray-100 text-gray-800' : ''}
                ${badge.rarity === 'uncommon' ? 'bg-green-100 text-green-800' : ''}
                ${badge.rarity === 'rare' ? 'bg-blue-100 text-blue-800' : ''}
                ${badge.rarity === 'epic' ? 'bg-purple-100 text-purple-800' : ''}
                ${badge.rarity === 'legendary' ? 'bg-yellow-100 text-yellow-800' : ''}
              `}>
                {badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1)}
              </span>
            </div>
          </div>
          
          {/* Progress section */}
          {badge.progress && !badge.isEarned && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{badge.progress.current} / {badge.progress.target}</span>
              </div>
              <Progress value={badge.progress.percentage} className="h-3" />
              <div className="text-center text-sm text-muted-foreground">
                {badge.progress.percentage.toFixed(1)}% complete
              </div>
            </div>
          )}
          
          {/* Earned status */}
          {badge.isEarned && badge.earnedAt && (
            <div className="flex items-center gap-2 text-green-600">
              <Trophy className="w-4 h-4" />
              <span className="text-sm font-medium">
                Earned on {new Date(badge.earnedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface CategoryBadgesProps {
  categoryName: string
  categoryEmoji: string
  categoryDescription: string
  badges: BadgeProps[]
  showAll?: boolean
}

export function CategoryBadges({ 
  categoryName, 
  categoryEmoji, 
  categoryDescription, 
  badges,
  showAll = false
}: CategoryBadgesProps) {
  const earnedBadges = badges.filter(b => b.isEarned)
  const inProgressBadges = badges.filter(b => !b.isEarned && b.progress && b.progress.percentage > 0)
  const lockedBadges = badges.filter(b => !b.isEarned && (!b.progress || b.progress.percentage === 0))
  
  const displayBadges = showAll ? badges : [...earnedBadges, ...inProgressBadges.slice(0, 3), ...lockedBadges.slice(0, 2)]

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Category header */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{categoryEmoji}</span>
            <div>
              <h3 className="text-lg font-semibold">{categoryName}</h3>
              <p className="text-sm text-muted-foreground">{categoryDescription}</p>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {earnedBadges.length} / {badges.length}
            </div>
          </div>
          
          {/* Progress bar for category */}
          <Progress value={(earnedBadges.length / badges.length) * 100} className="h-2" />
          
          {/* Badges grid */}
          <div className="grid grid-cols-6 gap-3">
            {displayBadges.map((badge) => (
              <div key={badge.key} className="flex flex-col items-center">
                <SingleBadgeDisplay 
                  badge={badge} 
                  size="sm" 
                  showProgress={true}
                />
              </div>
            ))}
          </div>
          
          {!showAll && badges.length > displayBadges.length && (
            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                +{badges.length - displayBadges.length} more badges...
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}