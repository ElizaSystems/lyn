'use client'

/**
 * Auth context provider for global auth state
 */

import React, { createContext, useContext } from 'react'
import { useAuth } from '@/hooks/use-auth'

interface AuthContextValue {
  user: {
    id: string
    walletAddress: string
    username?: string
    tokenBalance: number
    hasTokenAccess: boolean
  } | null
  loading: boolean
  error: string | null
  setAuthToken: (token: string) => Promise<void>
  logout: () => Promise<void>
  refetch: () => Promise<void>
  isAuthenticated: boolean
  hasUsername: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}