'use client'

import React, { useState, useEffect } from 'react'
import { Wallet, Link, Unlink, Trophy, Loader2 } from 'lucide-react'
import { useWallet } from '@wallet-ui/react'
import bs58 from 'bs58'

interface WalletLinkProps {
  telegramId: number
  onLinked?: (walletAddress: string) => void
}

export function TelegramWalletLink({ telegramId, onLinked }: WalletLinkProps) {
  const { publicKey, signMessage, connect, disconnect, connected } = useWallet()
  const [isLinking, setIsLinking] = useState(false)
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null)
  const [linkingCode, setLinkingCode] = useState<string>('')
  const [userStats, setUserStats] = useState<any>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  useEffect(() => {
    // Generate linking code
    const code = generateLinkingCode(telegramId)
    setLinkingCode(code)
    
    // Load user stats
    loadUserStats()
  }, [telegramId])

  const generateLinkingCode = (id: number): string => {
    const timestamp = Date.now()
    const data = `LYN_LINK_${id}_${timestamp}`
    return Buffer.from(data).toString('base64').slice(0, 16)
  }

  const loadUserStats = async () => {
    try {
      const response = await fetch(`/api/telegram/leaderboard?telegramId=${telegramId}`)
      const data = await response.json()
      
      if (data.userStats) {
        setUserStats(data.userStats)
        setLinkedWallet(data.userStats.walletAddress)
      }
      
      setLeaderboard(data.leaderboard || [])
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleLinkWallet = async () => {
    if (!connected) {
      await connect()
      return
    }

    if (!publicKey || !signMessage) {
      alert('Please connect your wallet first')
      return
    }

    setIsLinking(true)

    try {
      // Create message to sign
      const message = `Link LYN wallet to Telegram\nCode: ${linkingCode}`
      const messageBytes = new TextEncoder().encode(message)
      
      // Sign the message
      const signature = await signMessage(messageBytes)
      const signatureBase58 = bs58.encode(signature)

      // Send to API
      const response = await fetch('/api/telegram/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          walletAddress: publicKey.toBase58(),
          signature: signatureBase58,
          linkingCode,
          initData: window.Telegram?.WebApp?.initData
        })
      })

      const data = await response.json()

      if (data.success) {
        setLinkedWallet(data.walletAddress)
        await loadUserStats()
        
        if (onLinked) {
          onLinked(data.walletAddress)
        }
        
        // Show success message
        if (window.Telegram?.WebApp?.showPopup) {
          window.Telegram.WebApp.showPopup({
            title: 'Success!',
            message: `Wallet ${data.walletAddress.slice(0, 4)}...${data.walletAddress.slice(-4)} linked successfully!`,
            buttons: [{ type: 'ok' }]
          })
        }
      } else {
        throw new Error(data.error || 'Failed to link wallet')
      }
    } catch (error) {
      console.error('Wallet linking error:', error)
      if (window.Telegram?.WebApp?.showPopup) {
        window.Telegram.WebApp.showPopup({
          title: 'Error',
          message: 'Failed to link wallet. Please try again.',
          buttons: [{ type: 'ok' }]
        })
      }
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlinkWallet = async () => {
    const confirm = window.Telegram?.WebApp?.showConfirm 
      ? await window.Telegram.WebApp.showConfirm('Are you sure you want to unlink your wallet?')
      : window.confirm('Are you sure you want to unlink your wallet?')
    
    if (!confirm) return

    try {
      const response = await fetch('/api/telegram/link-wallet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId })
      })

      const data = await response.json()

      if (data.success) {
        setLinkedWallet(null)
        setUserStats(null)
        disconnect()
        
        if (window.Telegram?.WebApp?.showPopup) {
          window.Telegram.WebApp.showPopup({
            title: 'Success',
            message: 'Wallet unlinked successfully',
            buttons: [{ type: 'ok' }]
          })
        }
      }
    } catch (error) {
      console.error('Failed to unlink wallet:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Wallet Connection Card */}
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold">Solana Wallet</h3>
          </div>
          {linkedWallet && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
              Linked
            </span>
          )}
        </div>

        {linkedWallet ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Address:</span>
              <span className="font-mono text-xs">
                {linkedWallet.slice(0, 4)}...{linkedWallet.slice(-4)}
              </span>
            </div>
            
            {userStats && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Total Scans:</span>
                  <span>{userStats.totalScans}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Threats Found:</span>
                  <span className="text-red-400">{userStats.threatsDetected}</span>
                </div>
                {userStats.rank && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Leaderboard Rank:</span>
                    <span className="text-yellow-400">#{userStats.rank}</span>
                  </div>
                )}
              </>
            )}
            
            <button
              onClick={handleUnlinkWallet}
              className="w-full mt-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              Unlink Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Link your Solana wallet to track scans on the leaderboard and earn rewards
            </p>
            <button
              onClick={handleLinkWallet}
              disabled={isLinking}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  {connected ? 'Link Wallet' : 'Connect & Link'}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard Card */}
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold">Leaderboard</h3>
          </div>
          <span className="text-xs text-zinc-400">
            {showLeaderboard ? '▼' : '▶'}
          </span>
        </button>

        {showLeaderboard && (
          <div className="space-y-2">
            {leaderboard.length > 0 ? (
              leaderboard.slice(0, 5).map((user, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded ${
                    user.walletAddress === linkedWallet ? 'bg-purple-500/10 border border-purple-500/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {user.username || 'Anonymous'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {user.totalScans} scans
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-zinc-400">
                      {user.walletAddress?.slice(0, 4)}...{user.walletAddress?.slice(-4)}
                    </p>
                    <p className="text-xs text-green-400">
                      {user.accuracy}% accuracy
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-400 text-center py-4">
                No leaderboard data yet. Be the first!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}