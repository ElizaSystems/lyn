import mongoose, { Schema, Document } from 'mongoose'

export interface IPhishingReport extends Document {
  _id: string
  reporterId: string
  reporterUsername: string
  url?: string
  domain?: string
  reporterEmail?: string
  description: string
  category: 'phishing' | 'scam' | 'malware' | 'impersonation' | 'other'
  status: 'pending' | 'verified' | 'false_positive' | 'investigating'
  severity: 'low' | 'medium' | 'high' | 'critical'
  evidence?: {
    screenshots?: string[]
    headers?: any
    content?: string
  }
  analysis?: {
    aiScore: number
    indicators: string[]
    verdict: string
    analyzedAt: Date
  }
  communityVotes: {
    legitimate: number
    suspicious: number
    phishing: number
  }
  verifiedBy?: string
  verifiedAt?: Date
  xpRewarded?: number
  tags: string[]
  isPublic: boolean
}

const PhishingReportSchema = new Schema({
  reporterId: {
    type: String,
    required: true
  },
  reporterUsername: {
    type: String,
    required: true
  },
  url: String,
  domain: String,
  reporterEmail: String,
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['phishing', 'scam', 'malware', 'impersonation', 'other']
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'verified', 'false_positive', 'investigating']
  },
  severity: {
    type: String,
    default: 'medium',
    enum: ['low', 'medium', 'high', 'critical']
  },
  evidence: {
    screenshots: [String],
    headers: Schema.Types.Mixed,
    content: String
  },
  analysis: {
    aiScore: Number,
    indicators: [String],
    verdict: String,
    analyzedAt: Date
  },
  communityVotes: {
    legitimate: { type: Number, default: 0 },
    suspicious: { type: Number, default: 0 },
    phishing: { type: Number, default: 0 }
  },
  verifiedBy: String,
  verifiedAt: Date,
  xpRewarded: Number,
  tags: [String],
  isPublic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

PhishingReportSchema.index({ reporterId: 1, createdAt: -1 })
PhishingReportSchema.index({ status: 1, severity: 1 })
PhishingReportSchema.index({ url: 1 })
PhishingReportSchema.index({ category: 1, status: 1 })

export const PhishingReport = mongoose.models.PhishingReport || mongoose.model<IPhishingReport>('PhishingReport', PhishingReportSchema)