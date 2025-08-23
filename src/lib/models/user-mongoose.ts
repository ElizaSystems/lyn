import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  _id: string
  wallet: string
  username?: string
  totalXp?: number
  reputation?: number
  level?: number
  currentStreak?: number
  longestStreak?: number
  badges?: string[]
  achievements?: string[]
  registeredAt?: Date
  lastActive?: Date
}

const UserSchema = new Schema({
  wallet: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  totalXp: {
    type: Number,
    default: 0
  },
  reputation: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  badges: [{
    type: String
  }],
  achievements: [{
    type: String
  }],
  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

UserSchema.index({ wallet: 1 })
UserSchema.index({ username: 1 })
UserSchema.index({ totalXp: -1 })
UserSchema.index({ reputation: -1 })

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)