# LYN Achievement/Badge System Implementation

## Overview

A comprehensive achievement and badge system has been implemented for the LYN security platform, featuring real-time progress tracking, automatic badge awarding, leaderboards, and integration with the existing notification system.

## Features Implemented

### 1. Achievement System Core
- **Achievement Categories**: Security Scanner, Threat Hunter, Community Guardian, Token Burner, Referral Master, Streak, Veteran, Rare/Secret
- **Achievement Tiers**: Bronze, Silver, Gold, Diamond
- **Achievement Types**: Cumulative, Milestone, Streak, One-time, Secret
- **Real-time Progress Tracking**: Automatic progress updates based on user activities

### 2. Points/XP System
- **Level System**: 10 levels with increasing XP requirements
- **XP Sources**: Achievements, activities, milestones
- **Reputation System**: Separate reputation points for community standing
- **Level Benefits**: Titles, badges, feature unlocks

### 3. Leaderboards
- **Multiple Leaderboard Types**: XP, Reputation, Activity-specific, Category-specific
- **Time-based Filtering**: Daily, Weekly, Monthly, All-time
- **Comprehensive Scoring**: Combined XP + reputation + achievements
- **User Ranking**: Personal rank across all categories
- **Trending Users**: 24-hour activity-based trending

### 4. Activity Tracking
- **Real-time Tracking**: All user activities automatically tracked
- **Achievement Progress**: Automatic progress updates
- **Streak Tracking**: Daily, weekly activity streaks
- **Integration Points**: Scan service, burn service, referral service

## Files Created/Modified

### Models
- `/src/lib/models/achievement.ts` - Complete achievement data models
- `/src/lib/models/user.ts` - Updated with achievement fields

### Services
- `/src/lib/services/achievement-service.ts` - Core achievement logic
- `/src/lib/services/leaderboard-service.ts` - Leaderboard functionality
- `/src/lib/services/activity-tracker.ts` - Activity tracking and integrations
- `/src/lib/services/user-service.ts` - Enhanced with achievement integration
- `/src/lib/services/scan-service.ts` - Integrated achievement tracking
- `/src/lib/services/burn-service.ts` - Integrated achievement tracking
- `/src/lib/services/referral-service.ts` - Integrated achievement tracking

### API Endpoints
- `/src/app/api/achievements/route.ts` - Achievement definitions CRUD
- `/src/app/api/achievements/user/route.ts` - User achievements
- `/src/app/api/achievements/stats/route.ts` - User achievement statistics
- `/src/app/api/achievements/activity/route.ts` - Activity tracking endpoint
- `/src/app/api/achievements/progress/route.ts` - Achievement progress
- `/src/app/api/achievements/init/route.ts` - Initialize default achievements
- `/src/app/api/leaderboard/route.ts` - Leaderboard data
- `/src/app/api/leaderboard/user/[userId]/route.ts` - User leaderboard positions
- `/src/app/api/user/profile-with-achievements/route.ts` - Enhanced user profile

## Database Collections

The system uses the following MongoDB collections:

### Achievement Collections
- `achievement_definitions` - Achievement templates/definitions
- `user_achievements` - User's earned achievements
- `user_activities` - Activity tracking logs
- `user_stats` - User statistics and XP/reputation
- `achievement_progress` - Real-time progress tracking
- `challenges` - Time-limited challenges
- `user_challenges` - User challenge participation

## Default Achievements

The system comes with pre-configured achievements:

### Security Scanner Badges
- **Security Rookie**: 10 scans (Bronze, 50 XP, 10 reputation)
- **Security Guardian**: 100 scans (Silver, 200 XP, 50 reputation)
- **Security Expert**: 500 scans (Gold, 500 XP, 150 reputation, "Security Expert" title)
- **Security Master**: 1000 scans (Diamond, 1000 XP, 300 reputation, "Security Master" title)

### Threat Hunter Badges
- **Threat Spotter**: 5 threats detected (Bronze, 75 XP, 15 reputation)
- **Threat Tracker**: 25 threats detected (Silver, 250 XP, 75 reputation)
- **Threat Eliminator**: 100 threats detected (Gold, 600 XP, 200 reputation, "Threat Hunter" title)

### Token Burner Badges
- **Fire Starter**: 100 LYN burned (Bronze, 100 XP, 25 reputation)
- **Flame Keeper**: 1,000 LYN burned (Silver, 300 XP, 100 reputation)

### Referral Master Badges
- **Inviter**: 5 successful referrals (Bronze, 100 XP, 50 reputation)

### Streak Badges
- **Consistent**: 7-day activity streak (Bronze, 150 XP, 30 reputation)
- **Dedicated**: 30-day activity streak (Silver, 500 XP, 100 reputation)

## Usage Examples

### Track User Activity
```typescript
import { ActivityTracker } from '@/lib/services/activity-tracker'

// Track a completed security scan
await ActivityTracker.trackScanCompleted(userId, 'wallet', {
  scanId: 'scan123',
  severity: 'high',
  threatsFound: 2
})

// Track token burning
await ActivityTracker.trackTokensBurned(userId, 500, {
  transactionSignature: 'tx123',
  burnType: 'feature_unlock'
})

// Track daily login
await ActivityTracker.trackDailyLogin(userId)
```

### Get User Achievements
```typescript
import { AchievementService } from '@/lib/services/achievement-service'

// Get user statistics
const userStats = await AchievementService.getUserStats(userId)

// Get user achievements
const achievements = await AchievementService.getUserAchievements(userId, {
  category: 'security_scanner',
  isCompleted: true
})

// Get achievement progress
const progress = await AchievementService.getAchievementProgress(userId)
```

### Get Leaderboards
```typescript
import { LeaderboardService } from '@/lib/services/leaderboard-service'

// Get XP leaderboard
const xpLeaderboard = await LeaderboardService.getXPLeaderboard({
  timeframe: 'monthly'
}, 50, userId)

// Get category leaderboard
const scannerLeaderboard = await LeaderboardService.getCategoryLeaderboard(
  'security_scanner', 
  { timeframe: 'all_time' }, 
  50, 
  userId
)

// Get user's positions across all leaderboards
const positions = await LeaderboardService.getUserLeaderboardPositions(userId)
```

## API Usage

### Initialize Default Achievements (Admin Only)
```bash
POST /api/achievements/init
Authorization: Bearer <admin-token>
```

### Get User Achievements
```bash
GET /api/achievements/user?category=security_scanner&completed=true&include_stats=true
Authorization: Bearer <user-token>
```

### Track Activity
```bash
POST /api/achievements/activity
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "activityType": "scan_completed",
  "value": 1,
  "metadata": {
    "scanType": "wallet",
    "severity": "high"
  }
}
```

### Get Leaderboards
```bash
# XP Leaderboard
GET /api/leaderboard?type=xp&timeframe=monthly&limit=50&include_user_rank=true

# Token Burn Leaderboard
GET /api/leaderboard?type=burns&timeframe=all_time&limit=20

# Category Leaderboard
GET /api/leaderboard?type=category&category=security_scanner&limit=25
```

### Get Enhanced User Profile
```bash
GET /api/user/profile-with-achievements
Authorization: Bearer <user-token>
```

## Integration Points

The achievement system is automatically integrated with existing services:

1. **Scan Service**: Tracks scan completions and threat detections
2. **Burn Service**: Tracks token burning activities
3. **Referral Service**: Tracks successful referrals
4. **User Authentication**: Tracks daily logins
5. **Notification Service**: Sends achievement notifications

## Notifications

Achievement notifications are automatically sent through the existing notification system when:
- User earns a new achievement
- User levels up
- User reaches streak milestones
- User achieves leaderboard positions

## Level System

The system includes 10 levels with progressive XP requirements:

1. **Novice** (0 XP)
2. **Explorer** (100 XP)
3. **Guardian** (300 XP)
4. **Protector** (700 XP)
5. **Sentinel** (1,300 XP)
6. **Defender** (2,100 XP)
7. **Champion** (3,100 XP)
8. **Elite** (4,600 XP)
9. **Master** (6,600 XP)
10. **Legend** (9,600 XP)

## Future Enhancements

The system is designed to be extensible for future features:
- Seasonal achievements and challenges
- Guild/team achievements
- NFT badge integration
- Social sharing of achievements
- Achievement marketplace
- Custom user-created challenges

## Setup Instructions

1. Initialize default achievements by calling the init endpoint (admin only)
2. The system automatically tracks activities from integrated services
3. Users will start earning achievements based on their platform usage
4. Leaderboards update in real-time as users earn XP and reputation

The achievement system is now fully operational and integrated with the LYN security platform!