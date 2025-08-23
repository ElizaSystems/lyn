'use client'

import React, { useEffect, useState } from 'react'
import { useWallet } from '@/components/solana/solana-provider'

/**
 * Automatically prompts wallet connect and locks referral if URL or cookie has ?ref.
 * Only prompts ONCE - checks localStorage to see if already locked.
 */
export function ReferralAutoPrompt() {
  const { connected, publicKey, connect } = useWallet()
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        if (attempted) return
        const url = new URL(window.location.href)
        const ref = url.searchParams.get('ref') || document.cookie.split('; ').find(c => c.startsWith('referral-code='))?.split('=')[1]
        if (!ref) return

        // Require wallet connect
        if (!connected) {
          try { await connect() } catch { /* ignore */ }
        }
        if (!publicKey) return

        // Check if we've already locked this referral for this wallet
        const lockKey = `referral_locked_${publicKey.toString()}`
        if (localStorage.getItem(lockKey)) {
          console.log('[Referral] Already locked for this wallet, skipping prompt')
          return
        }

        // Check with backend if already has a referrer
        try {
          const checkResponse = await fetch(`/api/referral/v2/my-referrer?wallet=${publicKey.toString()}`)
          if (checkResponse.ok) {
            const data = await checkResponse.json()
            if (data?.walletAddress) {
              console.log('[Referral] User already has a referrer, skipping prompt')
              localStorage.setItem(lockKey, 'true')
              return
            }
          }
        } catch (e) {
          console.log('[Referral] Could not check existing referrer')
        }

        // Build message and sign
        const REQUIRED_PHRASE = 'Sign in to Lock in Your LYN Points with your Referrer'
        const message = `${REQUIRED_PHRASE}\nRef: ${ref}\nWallet: ${publicKey.toString()}\nTs: ${Date.now()}`

        // @ts-expect-error window.solana injected by wallet
        const { solana } = window
        if (!solana?.signMessage) return
        const encoded = new TextEncoder().encode(message)
        const sig = await solana.signMessage(encoded)

        // Normalize payload
        let payload: Record<string, unknown> = {
          walletAddress: publicKey.toString(),
          referralCode: ref,
          message
        }
        if (sig instanceof Uint8Array) {
          payload.signatureBytes = Array.from(sig)
        } else if (Array.isArray(sig)) {
          payload.signatureBytes = sig
        } else if (typeof sig === 'string') {
          payload.signature = sig
        } else if (sig && typeof sig === 'object' && 'signature' in sig && typeof sig.signature === 'string') {
          payload.signature = sig.signature
        } else {
          return
        }

        // Call lock API
        const lockResponse = await fetch('/api/referral/v2/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        })
        
        if (lockResponse.ok) {
          // Mark as locked in localStorage so we don't prompt again
          const lockKey = `referral_locked_${publicKey.toString()}`
          localStorage.setItem(lockKey, 'true')
          console.log('[Referral] Successfully locked referral relationship')
        }
      } finally {
        setAttempted(true)
      }
    }
    // Delay to avoid racing with wallet hydration
    const t = setTimeout(run, 600)
    return () => clearTimeout(t)
  }, [attempted, connected, publicKey, connect])

  return null
}


