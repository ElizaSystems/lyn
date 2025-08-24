'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'

interface LogoutButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  showIcon?: boolean
  showText?: boolean
}

export function LogoutButton({ 
  className = '', 
  variant = 'ghost',
  showIcon = true,
  showText = true 
}: LogoutButtonProps) {
  const router = useRouter()
  
  const handleLogout = async () => {
    try {
      // Send logout request with token from multiple sources
      const token = localStorage.getItem('auth-token') || 
                   document.cookie.split('; ').find(row => row.startsWith('auth-token='))?.split('=')[1]
      
      const response = await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'x-auth-token': token
        } : {}
      })
      
      if (response.ok) {
        // Clear all token storage
        localStorage.removeItem('auth-token')
        localStorage.removeItem('walletAddress')
        localStorage.removeItem('username')
        
        // Clear cookies
        document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
        
        toast.success('Logged out successfully')
        
        // Redirect to home
        router.push('/')
        router.refresh()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to logout')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Network error during logout')
      
      // Clear local storage anyway
      localStorage.removeItem('auth-token')
      localStorage.removeItem('walletAddress')
      localStorage.removeItem('username')
      
      router.push('/')
    }
  }
  
  return (
    <Button 
      onClick={handleLogout}
      variant={variant}
      className={className}
    >
      {showIcon && <LogOut className="h-4 w-4 mr-2" />}
      {showText && 'Logout'}
    </Button>
  )
}