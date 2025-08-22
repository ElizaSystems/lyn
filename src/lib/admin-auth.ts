/**
 * Admin authentication and authorization
 */

import { NextRequest } from 'next/server'
import { getCurrentUser } from './auth'
import { isAdminWallet } from './config'

export interface AdminUser {
  id: string
  walletAddress: string
  username?: string
  tokenBalance: number
  hasTokenAccess: boolean
  isAdmin: true
}

/**
 * Check if current user is an admin
 */
export async function requireAdmin(request: NextRequest): Promise<{
  user: AdminUser
  error?: never
} | {
  user?: never
  error: { message: string; status: number }
}> {
  // First check if user is authenticated
  const user = await getCurrentUser(request)
  
  if (!user) {
    return {
      error: { message: 'Authentication required', status: 401 }
    }
  }
  
  // Check if wallet is in admin list
  if (!isAdminWallet(user.walletAddress)) {
    return {
      error: { message: 'Admin access required', status: 403 }
    }
  }
  
  return {
    user: {
      ...user,
      isAdmin: true as const
    }
  }
}

/**
 * Check if a wallet address is an admin (for client-side checks)
 */
export function checkAdminAccess(walletAddress: string | null | undefined): boolean {
  if (!walletAddress) return false
  return isAdminWallet(walletAddress)
}