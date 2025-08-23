import { ethers } from 'ethers'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getDatabase } from '@/lib/mongodb'
import { 
  BlockchainType, 
  MultiChainBalance, 
  MultiChainToken
} from '@/lib/models/multi-chain'
import { MultiChainProviders } from './multi-chain-providers'
import { MultiChainConfig } from './multi-chain-config'
import { AddressValidationService } from './address-validation'
import { ObjectId } from 'mongodb'

/**
 * Token price service (placeholder - would integrate with real price APIs)
 */
interface TokenPrice {
  symbol: string
  priceUsd: number
  chain: BlockchainType
  address?: string
}

/**
 * Multi-chain balance aggregation service
 */
export class MultiChainBalanceAggregator {
  // Placeholder token prices (would integrate with CoinGecko, CoinMarketCap, etc.)
  private static readonly TOKEN_PRICES: Record<string, number> = {
    SOL: 100,
    ETH: 2000,
    BNB: 300,
    MATIC: 0.8,
    USDC: 1,
    USDT: 1
  }

  /**
   * Get database collections
   */
  private static async getCollections() {
    const db = await getDatabase()
    return {
      balances: db.collection<MultiChainBalance>('multi_chain_balances'),
      tokens: db.collection<MultiChainToken>('multi_chain_tokens')
    }
  }

  /**
   * Get aggregated balance for a wallet across all chains
   */
  static async getAggregatedBalance(walletId: ObjectId): Promise<{
    totalValueUsd: number
    balancesByChain: { [K in BlockchainType]?: {
      nativeBalance: string
      nativeValueUsd: number
      tokens: Array<{
        address: string
        symbol: string
        name?: string
        decimals: number
        balance: string
        valueUsd: number
      }>
      totalValueUsd: number
    }}
    lastUpdated: Date
  }> {
    const { balances } = await this.getCollections()
    
    const balance = await balances.findOne({ walletId })
    if (!balance) {
      throw new Error('Balance record not found')
    }

    // Calculate native currency values
    const balancesByChain: any = {}
    let totalValueUsd = 0

    for (const [chain, chainBalance] of Object.entries(balance.balances)) {
      const chainType = chain as BlockchainType
      const config = MultiChainConfig.getChainConfig(chainType)
      if (!config || !chainBalance) continue

      const nativeSymbol = config.nativeCurrency.symbol
      const nativePrice = this.TOKEN_PRICES[nativeSymbol] || 0
      
      // Calculate native balance value
      const nativeBalanceFloat = parseFloat(chainBalance.nativeBalance) / 
        Math.pow(10, config.nativeCurrency.decimals)
      const nativeValueUsd = nativeBalanceFloat * nativePrice

      // Calculate token values
      const tokens = chainBalance.tokens?.map(token => ({
        ...token,
        valueUsd: parseFloat(token.balance) * (this.TOKEN_PRICES[token.symbol] || 0) / 
          Math.pow(10, token.decimals)
      })) || []

      const tokenValueUsd = tokens.reduce((sum, token) => sum + token.valueUsd, 0)
      const chainTotalValueUsd = nativeValueUsd + tokenValueUsd

      balancesByChain[chainType] = {
        nativeBalance: chainBalance.nativeBalance,
        nativeValueUsd,
        tokens,
        totalValueUsd: chainTotalValueUsd
      }

      totalValueUsd += chainTotalValueUsd
    }

    return {
      totalValueUsd,
      balancesByChain,
      lastUpdated: balance.lastUpdated
    }
  }

  /**
   * Update balance for a specific chain and address
   */
  static async updateChainBalance(
    walletId: ObjectId,
    address: string,
    chain: BlockchainType
  ): Promise<void> {
    const { balances } = await this.getCollections()

    // Validate address
    const validation = AddressValidationService.validateAddress(address, chain)
    if (!validation.isValid) {
      throw new Error(`Invalid ${chain} address: ${validation.errorMessage}`)
    }

    // Get balance data
    const balanceData = await this.getChainBalanceData(address, chain)

    // Update or create balance record
    await balances.updateOne(
      { walletId },
      {
        $set: {
          [`balances.${chain}`]: balanceData,
          lastUpdated: new Date()
        },
        $setOnInsert: {
          walletId,
          address,
          createdAt: new Date()
        }
      },
      { upsert: true }
    )

    // Recalculate total value
    await this.recalculateTotalValue(walletId)
  }

  /**
   * Get balance data for a specific chain
   */
  private static async getChainBalanceData(
    address: string,
    chain: BlockchainType
  ): Promise<{
    nativeBalance: string
    tokens: Array<{
      address: string
      symbol: string
      name?: string
      decimals: number
      balance: string
      valueUsd?: number
    }>
    totalValueUsd: number
  }> {
    if (chain === 'solana') {
      return await this.getSolanaBalanceData(address)
    } else if (MultiChainConfig.isEvmChain(chain)) {
      return await this.getEvmBalanceData(address, chain)
    } else {
      throw new Error(`Unsupported chain: ${chain}`)
    }
  }

  /**
   * Get Solana balance data
   */
  private static async getSolanaBalanceData(address: string): Promise<{
    nativeBalance: string
    tokens: Array<{
      address: string
      symbol: string
      name?: string
      decimals: number
      balance: string
      valueUsd?: number
    }>
    totalValueUsd: number
  }> {
    const connection = MultiChainProviders.getSolanaConnection()
    const publicKey = new PublicKey(address)

    // Get SOL balance
    const lamports = await connection.getBalance(publicKey)
    const solBalance = lamports / LAMPORTS_PER_SOL
    const solValueUsd = solBalance * this.TOKEN_PRICES.SOL

    // Get SPL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    )

    const tokens: Array<{
      address: string
      symbol: string
      name?: string
      decimals: number
      balance: string
      valueUsd?: number
    }> = []

    let totalTokenValueUsd = 0

    for (const tokenAccount of tokenAccounts.value) {
      const accountData = tokenAccount.account.data.parsed.info
      const tokenAmount = accountData.tokenAmount
      
      if (parseFloat(tokenAmount.amount) === 0) continue

      // Get token metadata (simplified - would need token registry)
      const tokenInfo = await this.getTokenInfo(accountData.mint, 'solana')
      
      const tokenValueUsd = tokenInfo ? 
        (parseFloat(tokenAmount.amount) / Math.pow(10, tokenAmount.decimals)) * 
        (this.TOKEN_PRICES[tokenInfo.symbol] || 0) : 0

      tokens.push({
        address: accountData.mint,
        symbol: tokenInfo?.symbol || 'Unknown',
        name: tokenInfo?.name,
        decimals: tokenAmount.decimals,
        balance: tokenAmount.amount,
        valueUsd: tokenValueUsd
      })

      totalTokenValueUsd += tokenValueUsd
    }

    return {
      nativeBalance: lamports.toString(),
      tokens,
      totalValueUsd: solValueUsd + totalTokenValueUsd
    }
  }

  /**
   * Get EVM balance data
   */
  private static async getEvmBalanceData(
    address: string,
    chain: BlockchainType
  ): Promise<{
    nativeBalance: string
    tokens: Array<{
      address: string
      symbol: string
      name?: string
      decimals: number
      balance: string
      valueUsd?: number
    }>
    totalValueUsd: number
  }> {
    const provider = MultiChainProviders.getEvmProvider(chain)
    const config = MultiChainConfig.getChainConfig(chain)!

    // Get native balance
    const balance = await provider.getBalance(address)
    const nativeBalanceFloat = parseFloat(ethers.formatEther(balance))
    const nativeValueUsd = nativeBalanceFloat * (this.TOKEN_PRICES[config.nativeCurrency.symbol] || 0)

    // Get ERC-20 token balances (simplified implementation)
    // In production, you'd use services like Moralis, Alchemy, or Covalent
    const tokens: Array<{
      address: string
      symbol: string
      name?: string
      decimals: number
      balance: string
      valueUsd?: number
    }> = []

    // For now, check common tokens
    const commonTokens = await this.getCommonTokensForChain(chain)
    
    for (const tokenContract of commonTokens) {
      try {
        const tokenBalance = await this.getERC20Balance(address, tokenContract.address, provider)
        if (tokenBalance > 0) {
          const tokenValueUsd = (tokenBalance / Math.pow(10, tokenContract.decimals)) * 
            (this.TOKEN_PRICES[tokenContract.symbol] || 0)

          tokens.push({
            address: tokenContract.address,
            symbol: tokenContract.symbol,
            name: tokenContract.name,
            decimals: tokenContract.decimals,
            balance: (tokenBalance * Math.pow(10, tokenContract.decimals)).toString(),
            valueUsd: tokenValueUsd
          })
        }
      } catch (error) {
        console.warn(`Failed to get balance for token ${tokenContract.symbol}:`, error)
      }
    }

    const totalTokenValueUsd = tokens.reduce((sum, token) => sum + (token.valueUsd || 0), 0)

    return {
      nativeBalance: balance.toString(),
      tokens,
      totalValueUsd: nativeValueUsd + totalTokenValueUsd
    }
  }

  /**
   * Get ERC-20 token balance
   */
  private static async getERC20Balance(
    walletAddress: string,
    tokenAddress: string,
    provider: ethers.JsonRpcProvider
  ): Promise<number> {
    const contract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    )

    const balance = await contract.balanceOf(walletAddress)
    return parseFloat(balance.toString())
  }

  /**
   * Get common tokens for a chain
   */
  private static async getCommonTokensForChain(chain: BlockchainType): Promise<Array<{
    address: string
    symbol: string
    name: string
    decimals: number
  }>> {
    // Simplified common token list
    const commonTokens: Record<BlockchainType, Array<{
      address: string
      symbol: string
      name: string
      decimals: number
    }>> = {
      ethereum: [
        {
          address: '0xA0b86a33E6441b7178763cC4C5BC4e17a6fF2Fd1',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6
        },
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6
        }
      ],
      bsc: [
        {
          address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18
        },
        {
          address: '0x55d398326f99059fF775485246999027B3197955',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 18
        }
      ],
      polygon: [
        {
          address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6
        },
        {
          address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6
        }
      ],
      arbitrum: [
        {
          address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6
        }
      ],
      base: [
        {
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6
        }
      ],
      solana: [] // Handled separately
    }

    return commonTokens[chain] || []
  }

  /**
   * Get token information
   */
  private static async getTokenInfo(
    tokenAddress: string,
    chain: BlockchainType
  ): Promise<{ symbol: string; name: string; decimals: number } | null> {
    // Simplified token info lookup
    // In production, you'd use token registries, APIs, or on-chain queries
    return null
  }

  /**
   * Recalculate total USD value for a wallet
   */
  private static async recalculateTotalValue(walletId: ObjectId): Promise<void> {
    const { balances } = await this.getCollections()

    const balance = await balances.findOne({ walletId })
    if (!balance) return

    let totalValueUsd = 0

    for (const [chain, chainBalance] of Object.entries(balance.balances)) {
      if (!chainBalance) continue

      const config = MultiChainConfig.getChainConfig(chain as BlockchainType)
      if (!config) continue

      // Calculate native value
      const nativePrice = this.TOKEN_PRICES[config.nativeCurrency.symbol] || 0
      const nativeBalanceFloat = parseFloat(chainBalance.nativeBalance) / 
        Math.pow(10, config.nativeCurrency.decimals)
      const nativeValueUsd = nativeBalanceFloat * nativePrice

      // Calculate token values
      const tokenValueUsd = (chainBalance.tokens || []).reduce((sum: number, token: any) => {
        const tokenValueUsd = (parseFloat(token.balance) / Math.pow(10, token.decimals)) * 
          (this.TOKEN_PRICES[token.symbol] || 0)
        return sum + tokenValueUsd
      }, 0)

      totalValueUsd += nativeValueUsd + tokenValueUsd
    }

    await balances.updateOne(
      { walletId },
      { $set: { totalValueUsd } }
    )
  }

  /**
   * Update all balances for a wallet
   */
  static async updateAllBalances(
    walletId: ObjectId,
    addresses: { [K in BlockchainType]?: string[] }
  ): Promise<MultiChainBalance> {
    const { balances } = await this.getCollections()

    const updatedBalances: { [K in BlockchainType]?: any } = {}
    let totalValueUsd = 0

    // Update each chain
    for (const [chain, addressList] of Object.entries(addresses)) {
      if (!addressList || addressList.length === 0) continue

      const chainType = chain as BlockchainType
      const address = addressList[0] // Use first address

      try {
        const balanceData = await this.getChainBalanceData(address, chainType)
        updatedBalances[chainType] = balanceData
        totalValueUsd += balanceData.totalValueUsd
      } catch (error) {
        console.error(`Failed to update balance for ${chainType}:`, error)
      }
    }

    const balanceDoc: MultiChainBalance = {
      walletId,
      address: Object.values(addresses).flat()[0] || 'unknown',
      balances: updatedBalances,
      totalValueUsd,
      lastUpdated: new Date(),
      createdAt: new Date()
    }

    await balances.replaceOne(
      { walletId },
      balanceDoc,
      { upsert: true }
    )

    return balanceDoc
  }

  /**
   * Get portfolio distribution
   */
  static async getPortfolioDistribution(walletId: ObjectId): Promise<{
    byChain: Array<{ chain: BlockchainType; valueUsd: number; percentage: number }>
    byToken: Array<{ symbol: string; valueUsd: number; percentage: number }>
  }> {
    const aggregated = await this.getAggregatedBalance(walletId)
    
    const byChain: Array<{ chain: BlockchainType; valueUsd: number; percentage: number }> = []
    const tokenValues: Record<string, number> = {}

    for (const [chain, chainBalance] of Object.entries(aggregated.balancesByChain)) {
      if (!chainBalance) continue

      const chainType = chain as BlockchainType
      const config = MultiChainConfig.getChainConfig(chainType)!
      
      byChain.push({
        chain: chainType,
        valueUsd: chainBalance.totalValueUsd,
        percentage: (chainBalance.totalValueUsd / aggregated.totalValueUsd) * 100
      })

      // Aggregate native currency
      const nativeSymbol = config.nativeCurrency.symbol
      tokenValues[nativeSymbol] = (tokenValues[nativeSymbol] || 0) + chainBalance.nativeValueUsd

      // Aggregate tokens
      for (const token of chainBalance.tokens) {
        tokenValues[token.symbol] = (tokenValues[token.symbol] || 0) + token.valueUsd
      }
    }

    const byToken = Object.entries(tokenValues).map(([symbol, valueUsd]) => ({
      symbol,
      valueUsd,
      percentage: (valueUsd / aggregated.totalValueUsd) * 100
    })).sort((a, b) => b.valueUsd - a.valueUsd)

    return { byChain, byToken }
  }

  /**
   * Get balance history (would need historical data storage)
   */
  static async getBalanceHistory(
    walletId: ObjectId,
    days: number = 30
  ): Promise<Array<{
    date: Date
    totalValueUsd: number
    balancesByChain: { [K in BlockchainType]?: number }
  }>> {
    // Placeholder - would need historical balance tracking
    return []
  }

  /**
   * Get token prices
   */
  static async getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
    // Placeholder - would integrate with real price APIs
    const prices: Record<string, number> = {}
    for (const symbol of symbols) {
      prices[symbol] = this.TOKEN_PRICES[symbol] || 0
    }
    return prices
  }
}