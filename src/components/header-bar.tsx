'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/components/solana/solana-provider'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'

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
      await disconnect()
    } else {
      setIsLoading(true)
      try {
        await connect()
      } catch (error) {
        console.error('Wallet connection error:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <span className="mr-2">📄</span> Edit
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {connected ? `${tokenBalance.toLocaleString()} LYN` : '0 LYN'}
          </span>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1 h-8"
            onClick={handleLoginClick}
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : connected && publicKey ? formatAddress(publicKey.toString()) : 'Login'}
          </Button>
        </div>
      </div>
    </header>
  )
}