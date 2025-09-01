'use client'

import React, { useState, useEffect } from 'react'
import { Send, Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Share2, History, Wallet, Trophy } from 'lucide-react'
import { TelegramProvider, useTelegram } from '@/lib/telegram/telegram-provider'
import { TelegramWalletLink } from '@/components/telegram/wallet-link'

interface ScanResult {
  scanId: string
  scanHash: string
  safe: boolean
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  confidence_score: number
  details: string[]
  recommendations: string[]
  threat_sources: Array<{
    name: string
    safe: boolean
    score: number
    threats: string[]
  }>
  consensus: 'safe' | 'suspicious' | 'dangerous'
  checked_url: string
  timestamp: string
}

interface ScanHistory {
  url: string
  result: ScanResult
  timestamp: Date
}

function TelegramMiniAppContent() {
  const telegram = useTelegram()
  const [url, setUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([])
  const [checksToday, setChecksToday] = useState(0)
  const [showHistory, setShowHistory] = useState(false)

  const MAX_FREE_CHECKS = 5

  useEffect(() => {
    // Load scan history and checks count from Telegram Cloud Storage
    if (window.Telegram?.WebApp?.CloudStorage) {
      window.Telegram.WebApp.CloudStorage.getItems(['scanHistory', 'checksToday', 'checkDate'], (error, result) => {
        if (!error && result) {
          const today = new Date().toDateString()
          if (result.checkDate === today) {
            setChecksToday(parseInt(result.checksToday || '0'))
          } else {
            // Reset for new day
            window.Telegram.WebApp.CloudStorage.setItem('checkDate', today)
            window.Telegram.WebApp.CloudStorage.setItem('checksToday', '0')
          }
          
          if (result.scanHistory) {
            try {
              setScanHistory(JSON.parse(result.scanHistory))
            } catch (e) {
              console.error('Failed to parse scan history:', e)
            }
          }
        }
      })
    }

    // Set up main button
    if (window.Telegram?.WebApp?.MainButton) {
      window.Telegram.WebApp.MainButton.setText('Scan Link')
      window.Telegram.WebApp.MainButton.color = '#0088cc'
      window.Telegram.WebApp.MainButton.onClick(() => handleScan())
    }

    return () => {
      if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.offClick(() => handleScan())
      }
    }
  }, [])

  const handleScan = async () => {
    if (!url.trim()) {
      telegram.showAlert('Please enter a URL to scan')
      return
    }

    if (checksToday >= MAX_FREE_CHECKS && !telegram.user?.isPremium) {
      const upgrade = await telegram.showConfirm(
        `You've reached your daily limit of ${MAX_FREE_CHECKS} free scans. Upgrade to premium for unlimited scans?`
      )
      if (upgrade) {
        window.Telegram?.WebApp?.openTelegramLink('https://t.me/premium')
      }
      return
    }

    setIsScanning(true)
    setError(null)
    setScanResult(null)
    telegram.hapticFeedback.impactOccurred('light')

    try {
      const response = await fetch('/api/telegram/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': telegram.initDataRaw || ''
        },
        body: JSON.stringify({ url: url.trim() })
      })

      if (!response.ok) {
        throw new Error('Failed to scan URL')
      }

      const result = await response.json()
      setScanResult(result)

      // Update scan history
      const newHistory: ScanHistory = {
        url: url.trim(),
        result,
        timestamp: new Date()
      }
      const updatedHistory = [newHistory, ...scanHistory.slice(0, 9)]
      setScanHistory(updatedHistory)

      // Save to Telegram Cloud Storage
      if (window.Telegram?.WebApp?.CloudStorage) {
        window.Telegram.WebApp.CloudStorage.setItem('scanHistory', JSON.stringify(updatedHistory))
        const newCount = checksToday + 1
        setChecksToday(newCount)
        window.Telegram.WebApp.CloudStorage.setItem('checksToday', newCount.toString())
      }

      // Haptic feedback based on result
      if (result.safe) {
        telegram.hapticFeedback.notificationOccurred('success')
      } else if (result.consensus === 'dangerous') {
        telegram.hapticFeedback.notificationOccurred('error')
      } else {
        telegram.hapticFeedback.notificationOccurred('warning')
      }

      // Show main button for sharing
      if (window.Telegram?.WebApp?.MainButton) {
        window.Telegram.WebApp.MainButton.setText('Share Result')
        window.Telegram.WebApp.MainButton.show()
      }

    } catch (err) {
      console.error('Scan error:', err)
      setError('Failed to scan URL. Please try again.')
      telegram.hapticFeedback.notificationOccurred('error')
    } finally {
      setIsScanning(false)
    }
  }

  const shareResult = () => {
    if (!scanResult) return
    
    const message = `🔍 LYN Security Scanner Result\n\nURL: ${scanResult.checked_url}\nStatus: ${scanResult.safe ? '✅ Safe' : '⚠️ Unsafe'}\nRisk Level: ${scanResult.risk_level}\nConfidence: ${scanResult.confidence_score}%\n\nScanned with @LYNSecurityBot`
    
    window.Telegram?.WebApp?.switchInlineQuery(message, ['users', 'groups', 'channels'])
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-orange-500'
      case 'critical': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getRiskIcon = (consensus: string) => {
    switch (consensus) {
      case 'safe': return <CheckCircle className="w-16 h-16 text-green-500" />
      case 'suspicious': return <AlertTriangle className="w-16 h-16 text-yellow-500" />
      case 'dangerous': return <XCircle className="w-16 h-16 text-red-500" />
      default: return <Shield className="w-16 h-16 text-gray-500" />
    }
  }

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 mx-auto mb-2 text-[var(--tg-theme-button-color)]" />
          <h1 className="text-2xl font-bold">LYN Security Scanner</h1>
          <p className="text-sm text-[var(--tg-theme-hint-color)] mt-1">
            Check links for phishing & scams
          </p>
          {telegram.user && (
            <p className="text-xs text-[var(--tg-theme-hint-color)] mt-2">
              Welcome, {telegram.user.firstName}! • {checksToday}/{MAX_FREE_CHECKS} scans today
            </p>
          )}
        </div>

        {/* Input Section */}
        <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-lg p-4 mb-4">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter suspicious URL..."
              className="flex-1 px-3 py-2 bg-[var(--tg-theme-bg-color)] rounded-lg border border-[var(--tg-theme-hint-color)] focus:outline-none focus:border-[var(--tg-theme-button-color)]"
              disabled={isScanning}
            />
            <button
              onClick={handleScan}
              disabled={isScanning || !url.trim()}
              className="px-4 py-2 bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {isScanning ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Wallet Linking Component */}
        {telegram.user && (
          <div className="mb-4">
            <TelegramWalletLink 
              telegramId={telegram.user.id} 
              onLinked={(address) => {
                telegram.showPopup({
                  title: 'Success!',
                  message: `Wallet linked! You can now track your scans on the leaderboard.`,
                  buttons: [{ type: 'ok' }]
                })
              }}
            />
          </div>
        )}

        {/* History Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full mb-4 px-4 py-2 bg-[var(--tg-theme-secondary-bg-color)] rounded-lg flex items-center justify-center gap-2 text-sm"
        >
          <History className="w-4 h-4" />
          {showHistory ? 'Hide' : 'Show'} Scan History
        </button>

        {/* Scan History */}
        {showHistory && scanHistory.length > 0 && (
          <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2">Recent Scans</h3>
            <div className="space-y-2">
              {scanHistory.map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setUrl(item.url)
                    setScanResult(item.result)
                    setShowHistory(false)
                  }}
                  className="p-2 bg-[var(--tg-theme-bg-color)] rounded cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs truncate flex-1">{item.url}</span>
                    {item.result.safe ? (
                      <CheckCircle className="w-4 h-4 text-green-500 ml-2" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 ml-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Scan Result */}
        {scanResult && (
          <div className="bg-[var(--tg-theme-secondary-bg-color)] rounded-lg p-4">
            <div className="text-center mb-4">
              {getRiskIcon(scanResult.consensus)}
              <h2 className="text-xl font-bold mt-2">
                {scanResult.safe ? 'Link Appears Safe' : 'Potential Threat Detected'}
              </h2>
              <p className={`text-sm mt-1 ${getRiskColor(scanResult.risk_level)}`}>
                Risk Level: {scanResult.risk_level.toUpperCase()}
              </p>
              <p className="text-xs text-[var(--tg-theme-hint-color)] mt-1">
                Confidence: {scanResult.confidence_score}%
              </p>
            </div>

            {/* Details */}
            {scanResult.details.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Analysis Details</h3>
                <div className="space-y-1">
                  {scanResult.details.slice(0, 3).map((detail, index) => (
                    <p key={index} className="text-xs text-[var(--tg-theme-hint-color)]">
                      {detail}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {scanResult.recommendations.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Recommendations</h3>
                <ul className="space-y-1">
                  {scanResult.recommendations.slice(0, 3).map((rec, index) => (
                    <li key={index} className="text-xs text-[var(--tg-theme-hint-color)] flex items-start">
                      <span className="mr-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Share Button */}
            <button
              onClick={shareResult}
              className="w-full px-4 py-2 bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] rounded-lg flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share Result
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-[var(--tg-theme-hint-color)]">
          <p>Powered by LYN AI Security</p>
          {!telegram.user?.isPremium && (
            <p className="mt-1">
              <button
                onClick={() => window.Telegram?.WebApp?.openTelegramLink('https://t.me/premium')}
                className="text-[var(--tg-theme-link-color)] underline"
              >
                Upgrade to Premium
              </button>
              {' '}for unlimited scans
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TelegramMiniApp() {
  return (
    <TelegramProvider>
      <TelegramMiniAppContent />
    </TelegramProvider>
  )
}