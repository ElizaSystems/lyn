'use client'

import { ThemeProvider } from './theme-provider'
import { Toaster } from './ui/sonner'
import React from 'react'
import { Sidebar } from '@/components/sidebar'
import { HeaderBar } from '@/components/header-bar'
import { AlphaDisclaimerModal } from '@/components/alpha-disclaimer-modal'

export function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <HeaderBar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      <AlphaDisclaimerModal />
      <Toaster />
    </ThemeProvider>
  )
}
