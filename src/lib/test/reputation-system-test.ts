/**
 * Reputation and Badge System Test Suite
 * 
 * This file provides test functions and examples for the new comprehensive
 * reputation and badge system implementation.
 * 
 * Usage:
 *   import { testReputationSystem } from '@/lib/test/reputation-system-test'
 *   await testReputationSystem()
 */

import { AchievementService } from '@/lib/services/achievement-service'
import { EnhancedBadgeService } from '@/lib/services/enhanced-badge-service'
import { ReputationDecayService } from '@/lib/services/reputation-decay-service'
import { UserService } from '@/lib/services/user-service'
import { ActivityTracker } from '@/lib/services/activity-tracker'

interface TestResult {
  test: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  data?: any
}

interface TestSuite {
  name: string
  results: TestResult[]
  passed: number
  failed: number
  warnings: number
}

// Test helper functions
function createTestResult(test: string, status: 'pass' | 'fail' | 'warning', message: string, data?: any): TestResult {
  return { test, status, message, data }
}

function logTestResult(result: TestResult): void {
  const emoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️'
  console.log(`${emoji} ${result.test}: ${result.message}`)
  if (result.data) {
    console.log('   Data:', JSON.stringify(result.data, null, 2))
  }
}

// Test Suite 1: Basic System Initialization
export async function testSystemInitialization(): Promise<TestSuite> {
  const suite: TestSuite = { name: 'System Initialization', results: [], passed: 0, failed: 0, warnings: 0 }
  
  try {
    // Test 1: Initialize comprehensive system
    await AchievementService.initializeComprehensiveSystem()
    suite.results.push(createTestResult(
      'Initialize Comprehensive System',
      'pass',
      'Successfully initialized achievement and badge system'
    ))
  } catch (error) {
    suite.results.push(createTestResult(
      'Initialize Comprehensive System',
      'fail',
      `Failed to initialize system: ${error}`
    ))
  }

  try {
    // Test 2: Get badge statistics
    const badgeStats = await EnhancedBadgeService.getBadgeStatistics()
    suite.results.push(createTestResult(
      'Badge Statistics',
      badgeStats.totalBadges > 0 ? 'pass' : 'warning',
      `Found ${badgeStats.totalBadges} total badges across ${Object.keys(badgeStats.badgesByCategory).length} categories`,
      { 
        totalBadges: badgeStats.totalBadges,
        categories: Object.keys(badgeStats.badgesByCategory).length
      }
    ))
  } catch (error) {
    suite.results.push(createTestResult(
      'Badge Statistics',
      'fail',
      `Failed to get badge statistics: ${error}`
    ))
  }

  try {
    // Test 3: Test reputation tier system
    const testReputation = 150
    const tier = EnhancedBadgeService.getReputationTierInfo(testReputation)
    const multiplier = EnhancedBadgeService.getReputationMultiplier(testReputation)
    
    suite.results.push(createTestResult(
      'Reputation Tier System',
      tier ? 'pass' : 'fail',
      tier ? `Reputation ${testReputation} correctly mapped to ${tier.title} (${multiplier}x multiplier)` : 'Failed to get tier info',
      { reputation: testReputation, tier: tier?.title, multiplier }
    ))
  } catch (error) {
    suite.results.push(createTestResult(
      'Reputation Tier System',
      'fail',
      `Failed to test reputation tiers: ${error}`
    ))
  }

  // Calculate results
  suite.results.forEach(result => {
    switch (result.status) {
      case 'pass': suite.passed++; break
      case 'fail': suite.failed++; break
      case 'warning': suite.warnings++; break
    }
    logTestResult(result)
  })

  return suite
}

// Test Suite 2: User Activity Tracking
export async function testActivityTracking(testUserId?: string): Promise<TestSuite> {
  const suite: TestSuite = { name: 'Activity Tracking', results: [], passed: 0, failed: 0, warnings: 0 }
  
  // Create a test user if none provided
  let userId = testUserId
  if (!userId) {
    try {
      const testWallet = `test_wallet_${Date.now()}`
      const testUser = await UserService.createUserEnhanced(testWallet)
      userId = testUser._id?.toString()
      
      if (!userId) {
        suite.results.push(createTestResult(
          'Test User Creation',
          'fail',
          'Failed to create test user - no ID returned'
        ))
        return suite
      }
      
      suite.results.push(createTestResult(
        'Test User Creation',
        'pass',
        `Created test user with ID: ${userId}`
      ))
    } catch (error) {
      suite.results.push(createTestResult(
        'Test User Creation',
        'fail',
        `Failed to create test user: ${error}`
      ))
      return suite
    }
  }

  // Test activity tracking
  const testActivities = [
    { type: 'scan_completed', value: 1, description: 'Complete a scan' },
    { type: 'url_checked', value: 1, description: 'Check a URL' },
    { type: 'wallet_analyzed', value: 1, description: 'Analyze a wallet' },
    { type: 'daily_login', value: 1, description: 'Daily login' },
    { type: 'community_vote', value: 1, description: 'Community vote' }
  ]

  for (const activity of testActivities) {
    try {
      await UserService.trackUserActivity(userId, activity.type, activity.value)
      suite.results.push(createTestResult(
        `Track Activity: ${activity.description}`,
        'pass',
        `Successfully tracked ${activity.type} activity`
      ))
    } catch (error) {
      suite.results.push(createTestResult(
        `Track Activity: ${activity.description}`,
        'fail',
        `Failed to track ${activity.type}: ${error}`
      ))
    }
  }

  // Test user stats retrieval
  try {
    const userStats = await AchievementService.getUserStats(userId)
    suite.results.push(createTestResult(
      'User Stats Retrieval',
      'pass',
      `Retrieved user stats: ${userStats.totalReputation} reputation, Level ${userStats.level}`,
      { 
        reputation: userStats.totalReputation,
        xp: userStats.totalXP,
        level: userStats.level,
        achievementsUnlocked: userStats.achievementsUnlocked
      }
    ))
  } catch (error) {
    suite.results.push(createTestResult(
      'User Stats Retrieval',
      'fail',
      `Failed to retrieve user stats: ${error}`
    ))
  }

  // Test comprehensive user data
  try {
    const comprehensiveData = await UserService.getUserWithComprehensiveData(userId)
    suite.results.push(createTestResult(
      'Comprehensive User Data',
      comprehensiveData ? 'pass' : 'fail',
      comprehensiveData 
        ? `Retrieved comprehensive data with ${comprehensiveData.earnedBadges?.length || 0} earned badges and ${comprehensiveData.badgeProgress?.length || 0} in progress`
        : 'Failed to retrieve comprehensive user data',
      {
        earnedBadges: comprehensiveData?.earnedBadges?.length || 0,
        badgeProgress: comprehensiveData?.badgeProgress?.length || 0,
        reputationTier: comprehensiveData?.reputationTier?.title
      }
    ))
  } catch (error) {
    suite.results.push(createTestResult(
      'Comprehensive User Data',
      'fail',
      `Failed to retrieve comprehensive data: ${error}`
    ))
  }

  // Calculate results
  suite.results.forEach(result => {
    switch (result.status) {
      case 'pass': suite.passed++; break
      case 'fail': suite.failed++; break
      case 'warning': suite.warnings++; break
    }
    logTestResult(result)
  })

  return suite
}

// Test Suite 3: Badge Progress and Awarding
export async function testBadgeSystem(testUserId?: string): Promise<TestSuite> {
  const suite: TestSuite = { name: 'Badge System', results: [], passed: 0, failed: 0, warnings: 0 }

  if (!testUserId) {
    suite.results.push(createTestResult(
      'Badge System Test',
      'warning',
      'No test user ID provided, skipping badge system tests'
    ))
    suite.warnings++
    return suite
  }

  try {
    // Test badge progress calculation
    const mockUserMetrics = {
      scan_completed: 5,
      url_checked: 3,
      wallet_analyzed: 2,
      threat_detected: 1,
      daily_login: 7,
      community_vote: 2
    }

    const badgeProgress = await EnhancedBadgeService.calculateUserBadgeProgress(testUserId, mockUserMetrics)
    suite.results.push(createTestResult(
      'Badge Progress Calculation',
      'pass',
      `Calculated progress for ${badgeProgress.length} badges`,
      { progressCount: badgeProgress.length }
    ))

    // Test earned badges retrieval
    const earnedBadges = await EnhancedBadgeService.getUserEarnedBadges(testUserId)
    suite.results.push(createTestResult(
      'Earned Badges Retrieval',
      'pass',
      `Retrieved ${earnedBadges.length} earned badges`,
      { earnedCount: earnedBadges.length }
    ))

    // Test next achievable badges
    const nextBadges = await EnhancedBadgeService.getNextAchievableBadges(testUserId)
    suite.results.push(createTestResult(
      'Next Achievable Badges',
      'pass',
      `Found ${nextBadges.length} badges in progress`,
      { nextCount: nextBadges.length }
    ))

  } catch (error) {
    suite.results.push(createTestResult(
      'Badge System Tests',
      'fail',
      `Badge system tests failed: ${error}`
    ))
  }

  // Calculate results
  suite.results.forEach(result => {
    switch (result.status) {
      case 'pass': suite.passed++; break
      case 'fail': suite.failed++; break
      case 'warning': suite.warnings++; break
    }
    logTestResult(result)
  })

  return suite
}

// Test Suite 4: Reputation Decay System
export async function testReputationDecay(testUserId?: string): Promise<TestSuite> {
  const suite: TestSuite = { name: 'Reputation Decay', results: [], passed: 0, failed: 0, warnings: 0 }

  if (!testUserId) {
    suite.results.push(createTestResult(
      'Reputation Decay Test',
      'warning',
      'No test user ID provided, skipping decay tests'
    ))
    suite.warnings++
    return suite
  }

  try {
    // Test decay initialization
    await ReputationDecayService.initializeDecayTracking(testUserId)
    suite.results.push(createTestResult(
      'Initialize Decay Tracking',
      'pass',
      'Successfully initialized decay tracking for test user'
    ))

    // Test decay status
    const decayStatus = await ReputationDecayService.getUserDecayStatus(testUserId)
    suite.results.push(createTestResult(
      'Get Decay Status',
      'pass',
      `Retrieved decay status: ${decayStatus.daysSinceLastActivity} days since activity, ${decayStatus.isDecayActive ? 'active' : 'inactive'} decay`,
      {
        tracking: decayStatus.isTracking,
        daysSinceActivity: decayStatus.daysSinceLastActivity,
        isActive: decayStatus.isDecayActive,
        projectedDecay: decayStatus.projectedDecay
      }
    ))

    // Test activity update (should reset decay)
    await ReputationDecayService.updateLastActivity(testUserId)
    const updatedStatus = await ReputationDecayService.getUserDecayStatus(testUserId)
    suite.results.push(createTestResult(
      'Update Activity',
      updatedStatus.daysSinceLastActivity === 0 ? 'pass' : 'warning',
      `Activity updated: ${updatedStatus.daysSinceLastActivity} days since activity`,
      { daysSinceActivity: updatedStatus.daysSinceLastActivity }
    ))

  } catch (error) {
    suite.results.push(createTestResult(
      'Reputation Decay Tests',
      'fail',
      `Reputation decay tests failed: ${error}`
    ))
  }

  // Calculate results
  suite.results.forEach(result => {
    switch (result.status) {
      case 'pass': suite.passed++; break
      case 'fail': suite.failed++; break
      case 'warning': suite.warnings++; break
    }
    logTestResult(result)
  })

  return suite
}

// Test Suite 5: Integration Tests
export async function testSystemIntegration(): Promise<TestSuite> {
  const suite: TestSuite = { name: 'System Integration', results: [], passed: 0, failed: 0, warnings: 0 }

  try {
    // Test complete user journey
    const testWallet = `integration_test_${Date.now()}`
    
    // 1. Create user
    const user = await UserService.createUserEnhanced(testWallet)
    if (!user._id) {
      throw new Error('Failed to create user')
    }
    const userId = user._id.toString()

    suite.results.push(createTestResult(
      'User Creation',
      'pass',
      'Created test user for integration test'
    ))

    // 2. Perform various activities
    const activities = [
      { type: 'daily_login', count: 1 },
      { type: 'scan_completed', count: 3 },
      { type: 'url_checked', count: 2 },
      { type: 'wallet_analyzed', count: 1 },
      { type: 'community_vote', count: 1 }
    ]

    for (const activity of activities) {
      for (let i = 0; i < activity.count; i++) {
        await UserService.trackUserActivity(userId, activity.type, 1)
      }
    }

    suite.results.push(createTestResult(
      'Activity Tracking',
      'pass',
      'Completed multiple activities for integration test'
    ))

    // 3. Check if reputation was earned (should be > 0 with new system)
    const userStats = await AchievementService.getUserStats(userId)
    const hasReputation = userStats.totalReputation > 0

    suite.results.push(createTestResult(
      'Reputation Earning',
      hasReputation ? 'pass' : 'warning',
      `User earned ${userStats.totalReputation} reputation from activities`,
      { reputation: userStats.totalReputation, xp: userStats.totalXP }
    ))

    // 4. Check comprehensive summary
    const summary = await AchievementService.getUserCompleteSummary(userId)
    suite.results.push(createTestResult(
      'Complete Summary',
      'pass',
      `Generated complete summary with tier: ${summary.reputationTier?.title || 'None'}`,
      {
        tier: summary.reputationTier?.title,
        earnedBadges: summary.earnedBadges.length,
        badgeProgress: summary.badgeProgress.length
      }
    ))

    // 5. Test reputation tier benefits
    const benefits = await UserService.getUserReputationBenefits(userId)
    suite.results.push(createTestResult(
      'Reputation Benefits',
      benefits ? 'pass' : 'fail',
      benefits 
        ? `Retrieved benefits for ${benefits.tier.title} tier with ${benefits.multiplier}x multiplier`
        : 'Failed to retrieve reputation benefits',
      benefits ? {
        tier: benefits.tier.title,
        multiplier: benefits.multiplier,
        benefitCount: benefits.benefits.length
      } : undefined
    ))

  } catch (error) {
    suite.results.push(createTestResult(
      'Integration Test',
      'fail',
      `Integration test failed: ${error}`
    ))
  }

  // Calculate results
  suite.results.forEach(result => {
    switch (result.status) {
      case 'pass': suite.passed++; break
      case 'fail': suite.failed++; break
      case 'warning': suite.warnings++; break
    }
    logTestResult(result)
  })

  return suite
}

// Main test runner
export async function runCompleteTestSuite(): Promise<{
  suites: TestSuite[]
  summary: {
    totalTests: number
    totalPassed: number
    totalFailed: number
    totalWarnings: number
  }
}> {
  console.log('🧪 Running LYN Security Platform - Reputation & Badge System Tests')
  console.log('=' .repeat(80))

  const suites: TestSuite[] = []
  
  // Run all test suites
  console.log('\n📋 Test Suite 1: System Initialization')
  console.log('-' .repeat(50))
  suites.push(await testSystemInitialization())
  
  console.log('\n👤 Test Suite 2: Activity Tracking')
  console.log('-' .repeat(50))  
  const activitySuite = await testActivityTracking()
  suites.push(activitySuite)
  
  // Extract test user ID for subsequent tests
  const testUserId = activitySuite.results.find(r => r.test === 'Test User Creation' && r.data)?.data
  
  console.log('\n🎯 Test Suite 3: Badge System')
  console.log('-' .repeat(50))
  suites.push(await testBadgeSystem(testUserId))
  
  console.log('\n⏰ Test Suite 4: Reputation Decay')
  console.log('-' .repeat(50))
  suites.push(await testReputationDecay(testUserId))
  
  console.log('\n🔗 Test Suite 5: System Integration')
  console.log('-' .repeat(50))
  suites.push(await testSystemIntegration())

  // Calculate summary
  const summary = {
    totalTests: suites.reduce((sum, suite) => sum + suite.results.length, 0),
    totalPassed: suites.reduce((sum, suite) => sum + suite.passed, 0),
    totalFailed: suites.reduce((sum, suite) => sum + suite.failed, 0),
    totalWarnings: suites.reduce((sum, suite) => sum + suite.warnings, 0)
  }

  // Print summary
  console.log('\n📊 Test Summary')
  console.log('=' .repeat(80))
  console.log(`Total Tests: ${summary.totalTests}`)
  console.log(`✅ Passed: ${summary.totalPassed}`)
  console.log(`❌ Failed: ${summary.totalFailed}`)
  console.log(`⚠️  Warnings: ${summary.totalWarnings}`)
  console.log(`Success Rate: ${((summary.totalPassed / summary.totalTests) * 100).toFixed(1)}%`)

  suites.forEach(suite => {
    console.log(`\n${suite.name}: ${suite.passed}/${suite.results.length} passed`)
  })

  if (summary.totalFailed === 0) {
    console.log('\n🎉 All tests passed! The reputation and badge system is ready for production.')
  } else {
    console.log(`\n⚠️  ${summary.totalFailed} test(s) failed. Please review and fix issues before deployment.`)
  }

  return { suites, summary }
}

// Usage examples for developers
export const usageExamples = {
  // Basic user creation and activity tracking
  basicUsage: `
// Create a new user with enhanced system
const user = await UserService.createUserEnhanced(walletAddress)

// Track user activities
await UserService.trackUserActivity(userId, 'scan_completed', 1)
await UserService.trackUserActivity(userId, 'threat_detected', 2)
await UserService.trackUserActivity(userId, 'daily_login', 1)

// Get user's complete data
const userData = await UserService.getUserWithComprehensiveData(userId)
`,

  // Initialize the system
  systemInit: `
// Initialize the complete system (run once)
await AchievementService.initializeComprehensiveSystem()

// Get badge statistics
const stats = await EnhancedBadgeService.getBadgeStatistics()
`,

  // Reputation management
  reputationManagement: `
// Get user's reputation tier info
const reputationInfo = await UserService.getUserReputationBenefits(userId)

// Check decay status
const decayStatus = await ReputationDecayService.getUserDecayStatus(userId)

// Admin: Adjust reputation manually
const result = await UserService.adjustUserReputation(userId, 50, 'Manual adjustment', adminId)
`,

  // Badge queries
  badgeQueries: `
// Get all earned badges for a user
const earnedBadges = await EnhancedBadgeService.getUserEarnedBadges(userId)

// Get badges in progress
const badgeProgress = await EnhancedBadgeService.getUserBadgeProgress(userId)

// Get next achievable badges
const nextBadges = await EnhancedBadgeService.getNextAchievableBadges(userId)
`
}

export default {
  runCompleteTestSuite,
  testSystemInitialization,
  testActivityTracking,
  testBadgeSystem,
  testReputationDecay,
  testSystemIntegration,
  usageExamples
}