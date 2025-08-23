import { NextRequest, NextResponse } from 'next/server'
import { connection } from '@/lib/solana'
import { EnhancedSubscriptionService } from '@/lib/services/enhanced-subscription-service'

export async function GET(request: NextRequest) {
  try {
    const subscriptionService = new EnhancedSubscriptionService(connection)
    
    // Get available subscription tiers
    const tiers = subscriptionService.getAvailableTiers()

    // Add additional information for each tier
    const tiersWithInfo = tiers.map(tier => ({
      tier: tier.tier,
      name: tier.name,
      description: tier.description,
      features: tier.features,
      pricing: {
        monthly: {
          SOL: tier.pricing.monthly.SOL,
          USDC: tier.pricing.monthly.USDC
        },
        yearly: {
          SOL: tier.pricing.yearly.SOL,
          USDC: tier.pricing.yearly.USDC,
          discountPercent: tier.pricing.yearly.discountPercent,
          savings: {
            SOL: (tier.pricing.monthly.SOL * 12) - tier.pricing.yearly.SOL,
            USDC: (tier.pricing.monthly.USDC * 12) - tier.pricing.yearly.USDC
          }
        }
      },
      limits: tier.limits,
      popular: tier.tier === 'pro', // Mark Pro as popular
      recommended: tier.tier === 'basic' // Mark Basic as recommended for new users
    }))

    return NextResponse.json({
      success: true,
      tiers: tiersWithInfo,
      supportedTokens: [
        {
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          icon: 'solana-icon-url' // Would be actual icon URL
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          icon: 'usdc-icon-url' // Would be actual icon URL
        }
      ],
      meta: {
        gracePeriodDays: 3,
        refundPolicy: 'Full refund available within 7 days of purchase if no services were used',
        autoRenewal: 'Auto-renewal requires manual payment initiation',
        trialAvailable: false
      }
    })

  } catch (error) {
    console.error('Error fetching subscription tiers:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch subscription tiers' },
      { status: 500 }
    )
  }
}