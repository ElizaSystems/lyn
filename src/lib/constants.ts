/**
 * Global constants for the LYN platform
 */

// Token Requirements
export const TOKEN_DECIMALS = 9

// Username Registration
export const USERNAME_BURN_COST = 1000 // 1,000 LYN tokens to burn for registration
export const USERNAME_REQUIRED_BALANCE = 10000 // 10,000 LYN tokens required to hold

// Staking Tiers
export const STAKING_TIERS = {
  BRONZE: 100,
  SILVER: 1000,
  GOLD: 10000,
  PLATINUM: 100000,
  TITANIUM: 1000000
} as const

// Burn Badges
export const BURN_BADGES = {
  FIRST_BURN: 1,
  ACTIVE_BURNER: 10000,
  BURN_CHAMPION: 100000,
  INFERNO_LORD: 1000000
} as const

// Referral Rewards
export const REFERRAL_REWARDS = {
  TIER1_PERCENTAGE: 30, // 30% to direct referrer
  TIER2_PERCENTAGE: 20, // 20% to referrer's referrer
} as const

// API Rate Limits
export const RATE_LIMITS = {
  REGISTER_USERNAME_PER_MINUTE: 3,
  SCAN_PER_DAY_BASIC: 2,
  SCAN_PER_DAY_PREMIUM: 20,
  SCAN_PER_DAY_UNLIMITED: -1 // No limit
} as const

// Access Tiers (in LYN tokens)
export const ACCESS_TIERS = {
  BASIC: 10000,    // 10k LYN
  PREMIUM: 100000, // 100k LYN  
  UNLIMITED: 10000000 // 10M LYN
} as const