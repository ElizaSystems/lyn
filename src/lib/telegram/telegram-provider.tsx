'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface TelegramUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
  isPremium?: boolean
  photoUrl?: string
}

interface TelegramContext {
  user: TelegramUser | null
  initDataRaw: string | null
  isReady: boolean
  startParam: string | null
  colorScheme: 'light' | 'dark'
  viewportHeight: number
  viewportWidth: number
  canSendData: boolean
  sendData: (data: string) => void
  close: () => void
  expand: () => void
  showAlert: (message: string) => void
  showConfirm: (message: string) => Promise<boolean>
  hapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
}

const TelegramContext = createContext<TelegramContext | null>(null)

export const useTelegram = () => {
  const context = useContext(TelegramContext)
  if (!context) {
    // Return a default context for non-Telegram environments
    return {
      user: null,
      initDataRaw: null,
      isReady: false,
      startParam: null,
      colorScheme: 'dark' as const,
      viewportHeight: 0,
      viewportWidth: 0,
      canSendData: false,
      sendData: () => {},
      close: () => {},
      expand: () => {},
      showAlert: (message: string) => alert(message),
      showConfirm: async (message: string) => window.confirm(message),
      hapticFeedback: {
        impactOccurred: () => {},
        notificationOccurred: () => {},
        selectionChanged: () => {}
      }
    }
  }
  return context
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [telegramData, setTelegramData] = useState<TelegramContext>({
    user: null,
    initDataRaw: null,
    isReady: false,
    startParam: null,
    colorScheme: 'dark',
    viewportHeight: 0,
    viewportWidth: 0,
    canSendData: false,
    sendData: () => {},
    close: () => {},
    expand: () => {},
    showAlert: (message: string) => alert(message),
    showConfirm: async (message: string) => window.confirm(message),
    hapticFeedback: {
      impactOccurred: () => {},
      notificationOccurred: () => {},
      selectionChanged: () => {}
    }
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      
      // Initialize Telegram Web App
      tg.ready()
      tg.expand()
      
      // Set colors
      tg.setHeaderColor('#1c1c1e')
      tg.setBackgroundColor('#1c1c1e')
      
      // Parse user data
      let user: TelegramUser | null = null
      if (tg.initDataUnsafe?.user) {
        const tgUser = tg.initDataUnsafe.user
        user = {
          id: tgUser.id,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
          languageCode: tgUser.language_code,
          isPremium: tgUser.is_premium,
          photoUrl: tgUser.photo_url
        }
      }
      
      // Update context with Telegram data
      setTelegramData({
        user,
        initDataRaw: tg.initData,
        isReady: true,
        startParam: tg.initDataUnsafe?.start_param || null,
        colorScheme: tg.colorScheme,
        viewportHeight: tg.viewportHeight,
        viewportWidth: window.innerWidth,
        canSendData: true,
        sendData: (data: string) => tg.sendData(data),
        close: () => tg.close(),
        expand: () => tg.expand(),
        showAlert: (message: string) => {
          tg.showAlert(message)
        },
        showConfirm: async (message: string) => {
          return new Promise((resolve) => {
            tg.showConfirm(message, (confirmed: boolean) => {
              resolve(confirmed)
            })
          })
        },
        hapticFeedback: {
          impactOccurred: (style) => {
            if (tg.HapticFeedback) {
              tg.HapticFeedback.impactOccurred(style)
            }
          },
          notificationOccurred: (type) => {
            if (tg.HapticFeedback) {
              tg.HapticFeedback.notificationOccurred(type)
            }
          },
          selectionChanged: () => {
            if (tg.HapticFeedback) {
              tg.HapticFeedback.selectionChanged()
            }
          }
        }
      })
      
      setIsReady(true)
    } else {
      // Non-Telegram environment (for testing)
      setIsReady(true)
    }
  }, [])

  return (
    <TelegramContext.Provider value={telegramData}>
      {children}
    </TelegramContext.Provider>
  )
}