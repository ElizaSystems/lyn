import mongoose from 'mongoose'

export interface IPaymentRecord {
  packageId: string
  stars: number
  scansAdded: number
  telegramPaymentChargeId: string
  providerPaymentChargeId?: string
  timestamp: Date
  refunded?: boolean
  refundedAt?: Date
}

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
  dailyScans: number
  dailyScansResetAt: Date
  purchasedScans: number
  totalStarsSpent: number
  payments?: IPaymentRecord[]
  lastScanAt?: Date
  createdAt: Date
  updatedAt: Date
}

const PaymentRecordSchema = new mongoose.Schema({
  packageId: { type: String, required: true },
  stars: { type: Number, required: true },
  scansAdded: { type: Number, required: true },
  telegramPaymentChargeId: { type: String, required: true },
  providerPaymentChargeId: String,
  timestamp: { type: Date, default: Date.now },
  refunded: { type: Boolean, default: false },
  refundedAt: Date
})

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
  dailyScans: { type: Number, default: 0 },
  dailyScansResetAt: { type: Date, default: Date.now },
  purchasedScans: { type: Number, default: 0 },
  totalStarsSpent: { type: Number, default: 0 },
  payments: [PaymentRecordSchema],
  lastScanAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

TelegramUserSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

export const TelegramUser = mongoose.models.TelegramUser || mongoose.model<ITelegramUser>('TelegramUser', TelegramUserSchema)