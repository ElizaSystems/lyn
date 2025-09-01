import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'LYN Security Scanner - Telegram Mini App',
  description: 'Check suspicious links for phishing and scams directly in Telegram',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1c1c1e',
}

export default function TelegramLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script src="https://telegram.org/js/telegram-web-app.js" async />
      {children}
    </>
  )
}