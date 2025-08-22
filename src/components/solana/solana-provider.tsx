'use client'
import dynamic from 'next/dynamic'
import { ReactNode, createContext, useContext, useState, useEffect } from 'react'
import { createSolanaMainnet, createSolanaDevnet, createSolanaLocalnet, createWalletUiConfig, WalletUi } from '@wallet-ui/react'

interface SolanaPublicKey {
  toString: () => string
}

interface SolanaWallet {
  isPhantom?: boolean
  connect: () => Promise<{ publicKey: SolanaPublicKey }>
  disconnect: () => Promise<void>
  on: (event: string, callback: (publicKey?: SolanaPublicKey) => void) => void
  isConnected?: boolean
  publicKey?: SolanaPublicKey
}

export const WalletButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiDropdown, {
  ssr: false,
})
export const ClusterButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiClusterDropdown, {
  ssr: false,
})

// Create mainnet cluster with custom RPC
const createMainnetCluster = () => {
  const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
  return {
    ...createSolanaMainnet(),
    endpoint: rpcEndpoint,
  }
}

const config = createWalletUiConfig({
  clusters: [createMainnetCluster(), createSolanaDevnet(), createSolanaLocalnet()]
})

// Wallet context for easier access
interface WalletContextType {
  publicKey: SolanaPublicKey | null
  connected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  connected: false,
  connect: async () => {},
  disconnect: async () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

function WalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Create a simple wallet interface
  const [publicKey, setPublicKey] = useState<SolanaPublicKey | null>(null)
  const [connected, setConnected] = useState(false)

  const connect = async () => {
    if (typeof window !== 'undefined') {
      try {
        // Try to connect to Phantom wallet (most common)
        const { solana } = window as Window & { solana?: SolanaWallet }
        
        // Check if we're on mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        
        if (solana && solana.isPhantom) {
          const response = await solana.connect()
          setPublicKey(response.publicKey)
          setConnected(true)
        } else if (isMobile) {
          // On mobile, try to open Phantom app via deep link
          const dappUrl = encodeURIComponent(window.location.href)
          const deepLink = `https://phantom.app/ul/browse/${dappUrl}?ref=${dappUrl}`
          window.location.href = deepLink
        } else {
          // Desktop: Show connection instructions
          alert('Please install Phantom wallet extension from phantom.app')
          window.open('https://phantom.app', '_blank')
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error)
        // Try mobile fallback if connection fails
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          const dappUrl = encodeURIComponent(window.location.href)
          const deepLink = `https://phantom.app/ul/browse/${dappUrl}?ref=${dappUrl}`
          window.location.href = deepLink
        }
      }
    }
  }

  const disconnect = async () => {
    if (typeof window !== 'undefined') {
      try {
        const { solana } = window as Window & { solana?: SolanaWallet }
        if (solana && solana.disconnect) {
          await solana.disconnect()
        }
        setPublicKey(null)
        setConnected(false)
      } catch (error) {
        console.error('Failed to disconnect wallet:', error)
      }
    }
  }

  // Listen for wallet changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { solana } = window as Window & { solana?: SolanaWallet }
      if (solana) {
        solana.on('connect', (publicKey?: SolanaPublicKey) => {
          if (!publicKey) return
          setPublicKey(publicKey)
          setConnected(true)
        })
        solana.on('disconnect', () => {
          setPublicKey(null)
          setConnected(false)
        })
        
        // Check if already connected
        if (solana.isConnected && solana.publicKey) {
          setPublicKey(solana.publicKey)
          setConnected(true)
        }
      }
    }
  }, [mounted])

  if (!mounted) {
    return (
      <WalletContext.Provider value={{ publicKey: null, connected: false, connect, disconnect }}>
        {children}
      </WalletContext.Provider>
    )
  }

  return (
    <WalletContext.Provider value={{ publicKey, connected, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  return (
    <WalletUi config={config}>
      <WalletProvider>
        {children}
      </WalletProvider>
    </WalletUi>
  )
}