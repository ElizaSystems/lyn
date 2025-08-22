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

      // After wallet connects, attempt server authentication (nonce + signature)
      if (typeof window !== 'undefined') {
        interface SolanaWallet {
          publicKey?: { toString: () => string }
          signMessage?: (message: Uint8Array, encoding?: string) => Promise<Uint8Array>
        }
        const { solana } = window as Window & { solana?: SolanaWallet }
        const walletAddress = solana?.publicKey?.toString()
        if (solana && solana.signMessage && walletAddress) {
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
            let sigBytes = await solana.signMessage(encoded, 'utf8') as unknown
            // Normalize to Uint8Array for bs58
            if (Array.isArray(sigBytes)) {
              sigBytes = new Uint8Array(sigBytes as number[])
            } else if (typeof sigBytes === 'string') {
              // Assume base64 string
              const binary = atob(sigBytes as string)
              const bytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
              sigBytes = bytes
            }
            const signature = bs58.encode(sigBytes as Uint8Array)

            // 3) Login
            await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ walletAddress, signature, message })
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-2 sm:px-4 py-1 h-8 text-xs sm:text-sm"
            onClick={handleLoginClick}
            disabled={isLoading}
          >
            {isLoading ? '...' : connected && publicKey ? formatAddress(publicKey.toString()) : 'Login'}
          </Button>
        </div>
      </div>
    </header>
  )
}