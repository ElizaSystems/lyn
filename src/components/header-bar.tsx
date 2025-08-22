'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/components/solana/solana-provider'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'
import bs58 from 'bs58'

export function HeaderBar() {
  const { publicKey, connected, connect, disconnect } = useWallet()
  const [tokenBalance, setTokenBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)

  // Token configuration from environment
  const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'
  const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS) || 6
  const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'

  // Fetch token balance when wallet connects
  useEffect(() => {
    const fetchTokenBalance = async (walletAddress: string) => {
      try {
        const connection = new Connection(RPC_ENDPOINT, 'confirmed')
        const walletPubkey = new PublicKey(walletAddress)
        const mintPubkey = new PublicKey(TOKEN_MINT)
        
        const tokenAccountAddress = await getAssociatedTokenAddress(
          mintPubkey,
          walletPubkey
        )
        
        try {
          const tokenAccount = await getAccount(
            connection,
            tokenAccountAddress
          )
          const balance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_DECIMALS)
          setTokenBalance(Math.floor(balance))
        } catch {
          // Token account doesn't exist
          setTokenBalance(0)
        }
      } catch (error) {
        console.error('Error fetching token balance:', error)
        setTokenBalance(0)
      }
    }

    if (connected && publicKey) {
      fetchTokenBalance(publicKey.toString())
    } else {
      setTokenBalance(0)
    }
  }, [connected, publicKey, RPC_ENDPOINT, TOKEN_MINT, TOKEN_DECIMALS])


  const handleLoginClick = async () => {
    if (connected) {
      try {
        // Clear server session on logout
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      } catch (e) {
        // non-blocking
      }
      await disconnect()
      return
    }

    setIsLoading(true)
    try {
      await connect()

      // Small delay to ensure wallet connection is established
      await new Promise(resolve => setTimeout(resolve, 500))

      // After wallet connects, attempt server authentication (nonce + signature)
      if (typeof window !== 'undefined') {
        interface SolanaWallet {
          publicKey?: { toString: () => string }
          signMessage?: (message: Uint8Array, encoding?: string) => Promise<Uint8Array>
        }
        const { solana } = window as Window & { solana?: SolanaWallet }
        const walletAddress = publicKey?.toString() || solana?.publicKey?.toString()
        
        // Use the publicKey from context if available (for mobile wallets)
        if (walletAddress && solana && solana.signMessage) {
          // 1) Request nonce
          const nonceRes = await fetch('/api/auth/nonce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress })
          })
          if (nonceRes.ok) {
            const { message } = await nonceRes.json()
            const encoded = new TextEncoder().encode(message)
            // 2) Sign message and encode to base58 (server expects base58)
            const sig = await solana.signMessage(encoded) as unknown
            // Normalize to send either signatureBytes or signature string
            let payload: Record<string, unknown> = { walletAddress, message }
            const coerceToBytes = (value: unknown): number[] | null => {
              if (value instanceof Uint8Array) return Array.from(value)
              if (Array.isArray(value)) return value as number[]
              if (typeof value === 'string') {
                // Assume base64 string; if not, we'll send as base58 string below
                try {
                  const binary = atob(value as string)
                  const bytes = new Uint8Array(binary.length)
                  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
                  return Array.from(bytes)
                } catch {
                  return null
                }
              }
              return null
            }

            let bytes = coerceToBytes(sig)
            if (!bytes && typeof sig === 'object' && sig !== null && 'signature' in (sig as Record<string, unknown>)) {
              bytes = coerceToBytes((sig as Record<string, unknown>).signature)
            }

            if (bytes) {
              payload = { ...payload, signatureBytes: bytes }
            } else if (typeof sig === 'string') {
              // Send as base58 (or other) string; server will handle
              payload = { ...payload, signature: sig }
            } else if (typeof sig === 'object' && sig !== null && 'signature' in (sig as Record<string, unknown>) && typeof (sig as Record<string, unknown>).signature === 'string') {
              payload = { ...payload, signature: (sig as Record<string, string>).signature }
            } else {
              throw new Error('Unsupported signature return type')
            }

            // 3) Login
            await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload)
            })
          }
        }
      }
    } catch (error) {
      console.error('Wallet connection/auth error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm fixed lg:relative top-0 left-0 right-0 z-30">
      <div className="h-full px-4 sm:px-6 pl-[72px] lg:pl-6 flex items-center justify-between">
        <div className="flex-1" />

        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {connected ? `${tokenBalance.toLocaleString()} LYN` : '0 LYN'}
          </span>
          <span className="text-xs text-muted-foreground sm:hidden">
            {connected ? `${tokenBalance.toLocaleString()}` : '0'}
          </span>
          <Button 
            className="bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground px-3 sm:px-4 py-2 min-h-[44px] sm:min-h-0 sm:h-9 text-sm font-medium touch-manipulation"
            onClick={handleLoginClick}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? '...' : connected && publicKey ? formatAddress(publicKey.toString()) : 'Login'}
          </Button>
        </div>
      </div>
    </header>
  )
}