import mongoose, { Schema, Document } from 'mongoose'

export interface ISecurityTip extends Document {
  _id: string
  title: string
  content: string
  category: 'phishing' | 'malware' | 'password' | 'privacy' | 'crypto' | 'general'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  relatedLinks?: {
    title: string
    url: string
  }[]
  dateAdded: Date
  lastShown?: Date
  showCount: number
  likes: number
  isActive: boolean
}

const SecurityTipSchema = new Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: ['phishing', 'malware', 'password', 'privacy', 'crypto', 'general']
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  relatedLinks: [{
    title: String,
    url: String
  }],
  dateAdded: {
    type: Date,
    default: Date.now
  },
  lastShown: Date,
  showCount: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

SecurityTipSchema.index({ category: 1, isActive: 1 })
SecurityTipSchema.index({ lastShown: 1 })
SecurityTipSchema.index({ showCount: 1 })

export const SecurityTip = mongoose.models.SecurityTip || mongoose.model<ISecurityTip>('SecurityTip', SecurityTipSchema)