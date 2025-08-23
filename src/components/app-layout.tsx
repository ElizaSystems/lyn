'use client'

import { ThemeProvider } from './theme-provider'
import { Toaster } from './ui/sonner'
import React from 'react'
import { Sidebar } from '@/components/sidebar'
import { HeaderBar } from '@/components/header-bar'
import { AlphaDisclaimerModal } from '@/components/alpha-disclaimer-modal'
import { ReferralAutoPrompt } from '@/components/referral-auto-prompt'

export function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col w-full lg:w-auto">
          <HeaderBar />
          <ReferralAutoPrompt />
          <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
            {children}
          </main>
        </div>
      </div>
      <AlphaDisclaimerModal />
      <Toaster />
    </ThemeProvider>
  )
}
