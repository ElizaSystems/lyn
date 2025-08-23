import { NextRequest } from 'next/server'
import { getCurrentUser } from './auth'

export interface AuthResult {
  userId: string
  username?: string
  walletAddress: string
}

export async function verifyAuth(req: NextRequest): Promise<AuthResult | null> {
  const user = await getCurrentUser(req)
  if (!user || !user.walletAddress) {
    return null
  }
  
  return {
    userId: user.id,
    username: user.username,
    walletAddress: user.walletAddress
  }
}