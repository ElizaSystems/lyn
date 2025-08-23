import mongoose, { Schema, Document } from 'mongoose'

export interface IQuizQuestion extends Document {
  _id: string
  question: string
  options: {
    text: string
    isCorrect: boolean
    explanation?: string
  }[]
  category: 'phishing' | 'malware' | 'password' | 'privacy' | 'crypto' | 'general'
  difficulty: 'easy' | 'medium' | 'hard'
  xpReward: number
  explanation: string
  hints?: string[]
  imageUrl?: string
  isActive: boolean
  timesAnswered: number
  correctAnswers: number
  tags: string[]
}

export interface IQuizSession extends Document {
  _id: string
  userId: string
  username: string
  startedAt: Date
  completedAt?: Date
  questions: {
    questionId: string
    answeredCorrectly: boolean
    timeSpent: number
    hintsUsed: number
  }[]
  totalScore: number
  xpEarned: number
  streakBonus: number
  perfectScore: boolean
}

export interface IUserQuizStats extends Document {
  _id: string
  userId: string
  username: string
  totalQuizzes: number
  totalScore: number
  totalXpEarned: number
  currentStreak: number
  longestStreak: number
  lastQuizDate?: Date
  categoryScores: {
    phishing: number
    malware: number
    password: number
    privacy: number
    crypto: number
    general: number
  }
  achievements: string[]
}

const QuizQuestionSchema = new Schema({
  question: {
    type: String,
    required: true,
    maxlength: 500
  },
  options: [{
    text: {
      type: String,
      required: true,
      maxlength: 200
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    explanation: String
  }],
  category: {
    type: String,
    required: true,
    enum: ['phishing', 'malware', 'password', 'privacy', 'crypto', 'general']
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard']
  },
  xpReward: {
    type: Number,
    required: true,
    default: 10
  },
  explanation: {
    type: String,
    required: true,
    maxlength: 1000
  },
  hints: [String],
  imageUrl: String,
  isActive: {
    type: Boolean,
    default: true
  },
  timesAnswered: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  tags: [String]
}, {
  timestamps: true
})

const QuizSessionSchema = new Schema({
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
  questions: [{
    questionId: String,
    answeredCorrectly: Boolean,
    timeSpent: Number,
    hintsUsed: Number
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  xpEarned: {
    type: Number,
    default: 0
  },
  streakBonus: {
    type: Number,
    default: 0
  },
  perfectScore: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

const UserQuizStatsSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  totalQuizzes: {
    type: Number,
    default: 0
  },
  totalScore: {
    type: Number,
    default: 0
  },
  totalXpEarned: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastQuizDate: Date,
  categoryScores: {
    phishing: { type: Number, default: 0 },
    malware: { type: Number, default: 0 },
    password: { type: Number, default: 0 },
    privacy: { type: Number, default: 0 },
    crypto: { type: Number, default: 0 },
    general: { type: Number, default: 0 }
  },
  achievements: [String]
}, {
  timestamps: true
})

QuizQuestionSchema.index({ category: 1, difficulty: 1, isActive: 1 })
QuizSessionSchema.index({ userId: 1, completedAt: -1 })
UserQuizStatsSchema.index({ userId: 1 })
UserQuizStatsSchema.index({ totalScore: -1 })

export const QuizQuestion = mongoose.models.QuizQuestion || mongoose.model<IQuizQuestion>('QuizQuestion', QuizQuestionSchema)
export const QuizSession = mongoose.models.QuizSession || mongoose.model<IQuizSession>('QuizSession', QuizSessionSchema)
export const UserQuizStats = mongoose.models.UserQuizStats || mongoose.model<IUserQuizStats>('UserQuizStats', UserQuizStatsSchema)