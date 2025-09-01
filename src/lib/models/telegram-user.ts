import mongoose from 'mongoose'

export interface ITelegramUser {
  telegramId: number
  username?: string
  firstName: string
  lastName?: string
  walletAddress?: string
  walletLinkedAt?: Date
  totalScans: number
  safeScans: number
  threatsDetected: number
  isPremium: boolean
  lastScanAt?: Date
  createdAt: Date
  updatedAt: Date
}

const TelegramUserSchema = new mongoose.Schema<ITelegramUser>({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, sparse: true },
  firstName: { type: String, required: true },
  lastName: String,
  walletAddress: { type: String, sparse: true, index: true },
  walletLinkedAt: Date,
  totalScans: { type: Number, default: 0 },
  safeScans: { type: Number, default: 0 },
  threatsDetected: { type: Number, default: 0 },
  isPremium: { type: Boolean, default: false },
  lastScanAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

TelegramUserSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

export const TelegramUser = mongoose.models.TelegramUser || mongoose.model<ITelegramUser>('TelegramUser', TelegramUserSchema)