'use client'

import React, { useState, useEffect } from 'react'
import { Send, Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Share2, History, X } from 'lucide-react'

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

export default function TelegramMiniApp() {
  const [url, setUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([])
  const [checksToday, setChecksToday] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [telegramUser, setTelegramUser] = useState<any>(null)

  const MAX_FREE_CHECKS = 5

  useEffect(() => {
    // Initialize Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      
      // Set colors
      tg.setHeaderColor('#1c1c1e')
      tg.setBackgroundColor('#1c1c1e')
      
      // Get user data
      if (tg.initDataUnsafe?.user) {
        setTelegramUser(tg.initDataUnsafe.user)
      }

      // Load scan history
      if (tg.CloudStorage) {
        tg.CloudStorage.getItems(['scanHistory', 'checksToday', 'checkDate'], (error: any, result: any) => {
          if (!error && result) {
            const today = new Date().toDateString()
            if (result.checkDate === today) {
              setChecksToday(parseInt(result.checksToday || '0'))
            } else {
              tg.CloudStorage.setItem('checkDate', today)
              tg.CloudStorage.setItem('checksToday', '0')
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
      if (tg.MainButton) {
        tg.MainButton.setText('Scan Link')
        tg.MainButton.color = '#3b82f6'
        tg.MainButton.show()
      }
    }
  }, [])

  const handleScan = async () => {
    if (!url.trim()) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Please enter a URL to scan')
      } else {
        alert('Please enter a URL to scan')
      }
      return
    }

    if (checksToday >= MAX_FREE_CHECKS && !telegramUser?.is_premium) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showConfirm(
          `You've reached your daily limit of ${MAX_FREE_CHECKS} free scans. Upgrade to premium for unlimited scans?`,
          (confirmed: boolean) => {
            if (confirmed) {
              window.Telegram?.WebApp?.openTelegramLink('https://t.me/premium')
            }
          }
        )
      }
      return
    }

    setIsScanning(true)
    setError(null)
    setScanResult(null)
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light')
    }

    try {
      const response = await fetch('/api/telegram/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || ''
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

      // Haptic feedback
      if (window.Telegram?.WebApp?.HapticFeedback) {
        if (result.safe) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success')
        } else if (result.consensus === 'dangerous') {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('error')
        } else {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning')
        }
      }

    } catch (err) {
      console.error('Scan error:', err)
      setError('Failed to scan URL. Please try again.')
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error')
      }
    } finally {
      setIsScanning(false)
    }
  }

  const shareResult = () => {
    if (!scanResult) return
    
    const message = `🔍 LYN Security Scanner Result\n\nURL: ${scanResult.checked_url}\nStatus: ${scanResult.safe ? '✅ Safe' : '⚠️ Unsafe'}\nRisk Level: ${scanResult.risk_level}\nConfidence: ${scanResult.confidence_score}%\n\nScanned with @LYNGalacticBot`
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.switchInlineQuery(message, ['users', 'groups', 'channels'])
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return '#22c55e'
      case 'medium': return '#eab308'
      case 'high': return '#f97316'
      case 'critical': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getRiskIcon = (consensus: string) => {
    switch (consensus) {
      case 'safe': return <CheckCircle style={{ width: 64, height: 64, color: '#22c55e' }} />
      case 'suspicious': return <AlertTriangle style={{ width: 64, height: 64, color: '#eab308' }} />
      case 'dangerous': return <XCircle style={{ width: 64, height: 64, color: '#ef4444' }} />
      default: return <Shield style={{ width: 64, height: 64, color: '#6b7280' }} />
    }
  }

  // Inline styles for Telegram Mini App
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#111827',
      color: '#ffffff',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    maxWidth: {
      maxWidth: '448px',
      margin: '0 auto'
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '24px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginTop: '8px'
    },
    subtitle: {
      fontSize: '14px',
      color: '#9ca3af',
      marginTop: '4px'
    },
    card: {
      backgroundColor: '#1f2937',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px'
    },
    input: {
      flex: 1,
      padding: '8px 12px',
      backgroundColor: '#111827',
      border: '1px solid #374151',
      borderRadius: '8px',
      color: '#ffffff',
      fontSize: '14px',
      outline: 'none',
      width: '100%'
    },
    button: {
      padding: '8px 16px',
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    errorBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid #ef4444',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      color: '#ef4444'
    },
    resultCard: {
      backgroundColor: '#1f2937',
      borderRadius: '12px',
      padding: '16px'
    },
    historyItem: {
      padding: '8px',
      backgroundColor: '#111827',
      borderRadius: '8px',
      cursor: 'pointer',
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.header}>
          <Shield style={{ width: 48, height: 48, margin: '0 auto', color: '#3b82f6' }} />
          <h1 style={styles.title}>LYN Security Scanner</h1>
          <p style={styles.subtitle}>Check links for phishing & scams</p>
          {telegramUser && (
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              Welcome, {telegramUser.first_name}! • {checksToday}/{MAX_FREE_CHECKS} scans today
            </p>
          )}
        </div>

        {/* Input Section */}
        <div style={styles.card}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter suspicious URL..."
              style={styles.input}
              disabled={isScanning}
            />
            <button
              onClick={handleScan}
              disabled={isScanning || !url.trim()}
              style={{
                ...styles.button,
                ...(isScanning || !url.trim() ? styles.buttonDisabled : {})
              }}
            >
              {isScanning ? (
                <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send style={{ width: 20, height: 20 }} />
              )}
            </button>
          </div>
        </div>

        {/* History Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            ...styles.card,
            width: '100%',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <History style={{ width: 16, height: 16 }} />
          {showHistory ? 'Hide' : 'Show'} Scan History
        </button>

        {/* Scan History */}
        {showHistory && scanHistory.length > 0 && (
          <div style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontWeight: '600' }}>Recent Scans</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: 16, height: 16, color: '#6b7280' }} />
              </button>
            </div>
            <div>
              {scanHistory.map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setUrl(item.url)
                    setScanResult(item.result)
                    setShowHistory(false)
                  }}
                  style={styles.historyItem}
                >
                  <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.url}
                  </span>
                  {item.result.safe ? (
                    <CheckCircle style={{ width: 16, height: 16, color: '#22c55e', flexShrink: 0 }} />
                  ) : (
                    <XCircle style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={styles.errorBox}>
            <p>{error}</p>
          </div>
        )}

        {/* Scan Result */}
        {scanResult && (
          <div style={{
            ...styles.resultCard,
            border: scanResult.safe ? '1px solid #22c55e' : scanResult.consensus === 'suspicious' ? '1px solid #eab308' : '1px solid #ef4444',
            backgroundColor: scanResult.safe ? 'rgba(34, 197, 94, 0.05)' : scanResult.consensus === 'suspicious' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(239, 68, 68, 0.05)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              {getRiskIcon(scanResult.consensus)}
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '8px' }}>
                {scanResult.safe ? 'Link Appears Safe' : 'Potential Threat Detected'}
              </h2>
              <p style={{ fontSize: '14px', marginTop: '4px', color: getRiskColor(scanResult.risk_level) }}>
                Risk Level: {scanResult.risk_level.toUpperCase()}
              </p>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Confidence: {scanResult.confidence_score}%
              </p>
            </div>

            {/* Details */}
            {scanResult.details.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Analysis Details</h3>
                <div>
                  {scanResult.details.slice(0, 3).map((detail, index) => (
                    <p key={index} style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                      {detail}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {scanResult.recommendations.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Recommendations</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {scanResult.recommendations.slice(0, 3).map((rec, index) => (
                    <li key={index} style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', display: 'flex' }}>
                      <span style={{ marginRight: '4px' }}>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Share Button */}
            <button
              onClick={shareResult}
              style={{
                ...styles.button,
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <Share2 style={{ width: 16, height: 16 }} />
              Share Result
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#6b7280' }}>
          <p>Powered by LYN AI Security</p>
          {!telegramUser?.is_premium && (
            <p style={{ marginTop: '4px' }}>
              <button
                onClick={() => window.Telegram?.WebApp?.openTelegramLink('https://t.me/premium')}
                style={{ color: '#3b82f6', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Upgrade to Premium
              </button>
              {' '}for unlimited scans
            </p>
          )}
        </div>
      </div>

      {/* Add spinning animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}