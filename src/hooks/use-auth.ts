/**
 * Authentication hook for managing auth state
 */

import { useEffect, useState, useCallback } from 'react'

export interface AuthUser {
  id: string
  walletAddress: string
  username?: string
  tokenBalance: number
  hasTokenAccess: boolean
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get auth token from multiple sources
  const getAuthToken = useCallback((): string | null => {
    // Check localStorage first
    const localToken = localStorage.getItem('auth-token')
    if (localToken) return localToken

    // Check sessionStorage
    const sessionToken = sessionStorage.getItem('auth-token')
    if (sessionToken) return sessionToken

    // Check cookie
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'auth-token') return value
    }

    return null
  }, [])

  // Fetch user profile
  const fetchProfile = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-auth-token': token
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setError(null)
      } else if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('auth-token')
        sessionStorage.removeItem('auth-token')
        setUser(null)
      } else {
        setError('Failed to fetch user profile')
      }
    } catch (err) {
      console.error('[useAuth] Error fetching profile:', err)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  // Set auth token and fetch profile
  const setAuthToken = useCallback(async (token: string) => {
    // Store in multiple places for redundancy
    localStorage.setItem('auth-token', token)
    sessionStorage.setItem('auth-token', token)
    
    // Try to set cookie
    try {
      document.cookie = `auth-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`
    } catch (e) {
      console.warn('[useAuth] Could not set cookie:', e)
    }

    // Fetch profile immediately
    await fetchProfile()
  }, [fetchProfile])

  // Clear auth
  const logout = useCallback(async () => {
    const token = getAuthToken()
    
    // Clear all storage
    localStorage.removeItem('auth-token')
    sessionStorage.removeItem('auth-token')
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    
    // Call logout endpoint if token exists
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      } catch (e) {
        console.error('[useAuth] Logout error:', e)
      }
    }
    
    setUser(null)
    setError(null)
  }, [getAuthToken])

  // Check auth on mount and when token changes
  useEffect(() => {
    fetchProfile()

    // Listen for storage events (auth changes in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-token') {
        fetchProfile()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Check auth periodically to catch session extensions
    const interval = setInterval(fetchProfile, 60000) // Every minute

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [fetchProfile])

  return {
    user,
    loading,
    error,
    setAuthToken,
    logout,
    refetch: fetchProfile,
    isAuthenticated: !!user && !!user.walletAddress,
    hasUsername: !!user?.username
  }
}