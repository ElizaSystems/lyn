import mongoose, { Schema, Document } from 'mongoose'

export interface ISecurityChallenge extends Document {
  _id: string
  title: string
  description: string
  scenario: string
  objectives: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  category: 'phishing' | 'malware' | 'social_engineering' | 'network' | 'crypto' | 'incident_response'
  timeLimit?: number // in minutes
  xpReward: number
  badgeReward?: string
  hints: {
    text: string
    xpPenalty: number
  }[]
  solution: {
    steps: string[]
    explanation: string
  }
  requirements?: string[]
  simulationType: 'interactive' | 'quiz' | 'scenario' | 'ctf'
  isActive: boolean
  completions: number
  averageScore: number
  tags: string[]
}

export interface IChallengeAttempt extends Document {
  _id: string
  challengeId: string
  userId: string
  username: string
  startedAt: Date
  completedAt?: Date
  status: 'in_progress' | 'completed' | 'failed' | 'abandoned'
  score: number
  xpEarned: number
  hintsUsed: string[]
  answers?: any
  timeSpent: number
  attempts: number
  feedback?: string
}

export interface IUserChallengeStats extends Document {
  _id: string
  userId: string
  username: string
  totalChallenges: number
  completedChallenges: number
  totalXpEarned: number
  averageScore: number
  categoriesCompleted: {
    phishing: number
    malware: number
    social_engineering: number
    network: number
    crypto: number
    incident_response: number
  }
  difficultyCompleted: {
    beginner: number
    intermediate: number
    advanced: number
    expert: number
  }
  badges: string[]
  currentStreak: number
  longestStreak: number
  lastChallengeDate?: Date
}

const SecurityChallengeSchema = new Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  scenario: {
    type: String,
    required: true,
    maxlength: 5000
  },
  objectives: [{
    type: String,
    required: true
  }],
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced', 'expert']
  },
  category: {
    type: String,
    required: true,
    enum: ['phishing', 'malware', 'social_engineering', 'network', 'crypto', 'incident_response']
  },
  timeLimit: Number,
  xpReward: {
    type: Number,
    required: true,
    default: 50
  },
  badgeReward: String,
  hints: [{
    text: String,
    xpPenalty: Number
  }],
  solution: {
    steps: [String],
    explanation: String
  },
  requirements: [String],
  simulationType: {
    type: String,
    required: true,
    enum: ['interactive', 'quiz', 'scenario', 'ctf']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  completions: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  tags: [String]
}, {
  timestamps: true
})

const ChallengeAttemptSchema = new Schema({
  challengeId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  status: {
    type: String,
    default: 'in_progress',
    enum: ['in_progress', 'completed', 'failed', 'abandoned']
  },
  score: {
    type: Number,
    default: 0
  },
  xpEarned: {
    type: Number,
    default: 0
  },
  hintsUsed: [String],
  answers: Schema.Types.Mixed,
  timeSpent: {
    type: Number,
    default: 0
  },
  attempts: {
    type: Number,
    default: 1
  },
  feedback: String
}, {
  timestamps: true
})

const UserChallengeStatsSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  totalChallenges: {
    type: Number,
    default: 0
  },
  completedChallenges: {
    type: Number,
    default: 0
  },
  totalXpEarned: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  categoriesCompleted: {
    phishing: { type: Number, default: 0 },
    malware: { type: Number, default: 0 },
    social_engineering: { type: Number, default: 0 },
    network: { type: Number, default: 0 },
    crypto: { type: Number, default: 0 },
    incident_response: { type: Number, default: 0 }
  },
  difficultyCompleted: {
    beginner: { type: Number, default: 0 },
    intermediate: { type: Number, default: 0 },
    advanced: { type: Number, default: 0 },
    expert: { type: Number, default: 0 }
  },
  badges: [String],
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastChallengeDate: Date
}, {
  timestamps: true
})

SecurityChallengeSchema.index({ category: 1, difficulty: 1, isActive: 1 })
SecurityChallengeSchema.index({ completions: -1 })
ChallengeAttemptSchema.index({ userId: 1, challengeId: 1 })
ChallengeAttemptSchema.index({ userId: 1, status: 1 })
UserChallengeStatsSchema.index({ userId: 1 })
UserChallengeStatsSchema.index({ totalXpEarned: -1 })

export const SecurityChallenge = mongoose.models.SecurityChallenge || mongoose.model<ISecurityChallenge>('SecurityChallenge', SecurityChallengeSchema)
export const ChallengeAttempt = mongoose.models.ChallengeAttempt || mongoose.model<IChallengeAttempt>('ChallengeAttempt', ChallengeAttemptSchema)
export const UserChallengeStats = mongoose.models.UserChallengeStats || mongoose.model<IUserChallengeStats>('UserChallengeStats', UserChallengeStatsSchema)