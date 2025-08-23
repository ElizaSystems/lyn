import { ethers } from 'ethers'
import { Connection, PublicKey } from '@solana/web3.js'
import { getDatabase } from '@/lib/mongodb'
import { 
  BlockchainType, 
  BridgeActivity, 
  CrossChainTransaction 
} from '@/lib/models/multi-chain'
import { MultiChainProviders } from './multi-chain-providers'
import { AddressValidationService } from './address-validation'
import { ObjectId } from 'mongodb'

/**
 * Bridge transaction monitoring service
 */
export class BridgeMonitorService {
  /**
   * Known bridge protocols and their characteristics
   */
  private static readonly BRIDGE_PROTOCOLS = {
    // Wormhole
    wormhole: {
      name: 'Wormhole',
      contracts: {
        ethereum: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
        bsc: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
        polygon: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
        arbitrum: '0xa5f208e072434bC67592E4C49C1B991BA79BCA46',
        base: '0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627'
      },
      solanaProgram: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5'
    },
    // Portal Bridge (Wormhole Token Bridge)
    portal: {
      name: 'Portal Bridge',
      contracts: {
        ethereum: '0x0e082F06FF657D94310cB8cE8B0D9a04541d8052',
        bsc: '0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7',
        polygon: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
        arbitrum: '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c',
        base: '0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627'
      },
      solanaProgram: 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth'
    },
    // LayerZero
    layerzero: {
      name: 'LayerZero',
      contracts: {
        ethereum: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',
        bsc: '0x4D73AdB72bC3DD368966edD0f0b2148401A178E2',
        polygon: '0x3c2269811836af69497E5F486A85D7316753cf62',
        arbitrum: '0x3c2269811836af69497E5F486A85D7316753cf62',
        base: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
      }
    },
    // Multichain (Anyswap)
    multichain: {
      name: 'Multichain',
      contracts: {
        ethereum: '0xC564EE9f21Ed8A2d8E7e76c085740d5e4c5FaFbE',
        bsc: '0xd1C5966f9F5Ee6881Ff6b261BBeDa45972B1B5f3',
        polygon: '0x4f3Aff3A747fCADe12598081e80c6605A8be192F',
        arbitrum: '0xC564EE9f21Ed8A2d8E7e76c085740d5e4c5FaFbE'
      }
    },
    // Synapse
    synapse: {
      name: 'Synapse',
      contracts: {
        ethereum: '0x2796317b0fF8538F253012862c06787Adfb8cEb6',
        bsc: '0xd123f70AE324d34A9E76b67a27bf77593bA8749f',
        polygon: '0x8F5BBB2BB8c2Ee94639E55d5F41de9b4839C1280',
        arbitrum: '0x6F4e8eBa4D337f874Ab57478AcC2Cb5BACdc19c9'
      }
    },
    // Stargate
    stargate: {
      name: 'Stargate',
      contracts: {
        ethereum: '0x8731d54E9D02c286767d56ac03e8037C07e01e98',
        bsc: '0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8',
        polygon: '0x45A01E4e04F14f7A4a6702c74187c5F6222033cd',
        arbitrum: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614'
      }
    }
  }

  /**
   * Get database collections
   */
  private static async getCollections() {
    const db = await getDatabase()
    return {
      bridgeActivity: db.collection<BridgeActivity>('bridge_activity'),
      transactions: db.collection<CrossChainTransaction>('cross_chain_transactions')
    }
  }

  /**
   * Detect if a transaction is a bridge transaction
   */
  static async detectBridgeTransaction(
    txHash: string,
    chain: BlockchainType
  ): Promise<{
    isBridge: boolean
    bridgeInfo?: {
      protocol: string
      sourceChain: BlockchainType
      destinationChain?: BlockchainType
      amount?: string
      token?: string
    }
  }> {
    try {
      if (chain === 'solana') {
        return await this.detectSolanaBridge(txHash)
      } else if (['ethereum', 'bsc', 'polygon', 'arbitrum', 'base'].includes(chain)) {
        return await this.detectEvmBridge(txHash, chain)
      }

      return { isBridge: false }
    } catch (error) {
      console.error(`Failed to detect bridge transaction ${txHash} on ${chain}:`, error)
      return { isBridge: false }
    }
  }

  /**
   * Detect Solana bridge transactions
   */
  private static async detectSolanaBridge(txHash: string): Promise<{
    isBridge: boolean
    bridgeInfo?: {
      protocol: string
      sourceChain: BlockchainType
      destinationChain?: BlockchainType
      amount?: string
      token?: string
    }
  }> {
    const connection = MultiChainProviders.getSolanaConnection()
    
    try {
      const tx = await connection.getParsedTransaction(txHash)
      if (!tx || !tx.meta) {
        return { isBridge: false }
      }

      const instructions = tx.transaction.message.instructions
      
      // Check for Wormhole program interactions
      const wormholePrograms = [
        '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5', // Wormhole Core
        'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth'   // Wormhole Token Bridge
      ]

      for (const instruction of instructions) {
        const programId = typeof instruction.programId === 'string' 
          ? instruction.programId 
          : instruction.programId.toString()

        if (wormholePrograms.includes(programId)) {
          return {
            isBridge: true,
            bridgeInfo: {
              protocol: 'wormhole',
              sourceChain: 'solana',
              // Would need to parse instruction data to get destination
            }
          }
        }
      }

      return { isBridge: false }
    } catch (error) {
      console.error('Error detecting Solana bridge:', error)
      return { isBridge: false }
    }
  }

  /**
   * Detect EVM bridge transactions
   */
  private static async detectEvmBridge(
    txHash: string,
    chain: BlockchainType
  ): Promise<{
    isBridge: boolean
    bridgeInfo?: {
      protocol: string
      sourceChain: BlockchainType
      destinationChain?: BlockchainType
      amount?: string
      token?: string
    }
  }> {
    const provider = MultiChainProviders.getEvmProvider(chain)
    
    try {
      const tx = await provider.getTransaction(txHash)
      const receipt = await provider.getTransactionReceipt(txHash)
      
      if (!tx || !receipt) {
        return { isBridge: false }
      }

      // Check if transaction interacted with known bridge contracts
      for (const [protocolName, protocol] of Object.entries(this.BRIDGE_PROTOCOLS)) {
        const contractAddress = protocol.contracts[chain]
        if (!contractAddress) continue

        // Check if transaction was sent to bridge contract
        if (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) {
          return {
            isBridge: true,
            bridgeInfo: {
              protocol: protocolName,
              sourceChain: chain,
              amount: tx.value.toString()
            }
          }
        }

        // Check logs for bridge events
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
            return {
              isBridge: true,
              bridgeInfo: {
                protocol: protocolName,
                sourceChain: chain
              }
            }
          }
        }
      }

      return { isBridge: false }
    } catch (error) {
      console.error('Error detecting EVM bridge:', error)
      return { isBridge: false }
    }
  }

  /**
   * Track bridge activity for a wallet
   */
  static async trackBridgeActivity(
    userAddress: string,
    txHash: string,
    sourceChain: BlockchainType,
    bridgeProtocol: string,
    amount: string,
    tokenSymbol?: string,
    destinationChain?: BlockchainType
  ): Promise<BridgeActivity> {
    const { bridgeActivity } = await this.getCollections()

    const activity: BridgeActivity = {
      sourceTxHash: txHash,
      sourceChain,
      destinationChain: destinationChain || 'ethereum', // Default fallback
      bridgeProtocol,
      userAddress: AddressValidationService.normalizeAddress(userAddress, sourceChain),
      sourceAddress: userAddress,
      destinationAddress: userAddress, // Assume same for now
      tokenSymbol,
      amount,
      status: 'initiated',
      initiatedAt: new Date(),
      riskScore: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Calculate risk score
    activity.riskScore = await this.calculateBridgeRiskScore(activity)

    const result = await bridgeActivity.insertOne(activity)
    return { ...activity, _id: result.insertedId }
  }

  /**
   * Calculate risk score for bridge transaction
   */
  private static async calculateBridgeRiskScore(activity: BridgeActivity): Promise<number> {
    let riskScore = 0

    // Base risk for bridge transactions
    riskScore += 10

    // High amounts increase risk
    const amountValue = parseFloat(activity.amount)
    if (amountValue > 100000) { // > 100k USD equivalent
      riskScore += 30
    } else if (amountValue > 10000) {
      riskScore += 20
    } else if (amountValue > 1000) {
      riskScore += 10
    }

    // Uncommon bridge routes increase risk
    const commonRoutes = [
      'ethereum-bsc',
      'ethereum-polygon',
      'ethereum-arbitrum',
      'solana-ethereum'
    ]
    
    const route = `${activity.sourceChain}-${activity.destinationChain}`
    if (!commonRoutes.includes(route)) {
      riskScore += 15
    }

    // Unknown bridge protocols are riskier
    if (!Object.keys(this.BRIDGE_PROTOCOLS).includes(activity.bridgeProtocol)) {
      riskScore += 25
    }

    return Math.min(100, riskScore)
  }

  /**
   * Get bridge activity for a user
   */
  static async getUserBridgeActivity(
    userAddress: string,
    limit: number = 50
  ): Promise<BridgeActivity[]> {
    const { bridgeActivity } = await this.getCollections()

    return await bridgeActivity
      .find({ userAddress })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Update bridge transaction with destination details
   */
  static async updateBridgeDestination(
    sourceTxHash: string,
    destinationTxHash: string,
    destinationChain: BlockchainType
  ): Promise<void> {
    const { bridgeActivity } = await this.getCollections()

    await bridgeActivity.updateOne(
      { sourceTxHash },
      {
        $set: {
          destinationTxHash,
          destinationChain,
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    )
  }

  /**
   * Monitor pending bridge transactions
   */
  static async monitorPendingBridges(): Promise<void> {
    const { bridgeActivity } = await this.getCollections()

    const pendingBridges = await bridgeActivity
      .find({ 
        status: { $in: ['initiated', 'pending'] },
        initiatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      })
      .toArray()

    console.log(`Monitoring ${pendingBridges.length} pending bridge transactions`)

    for (const bridge of pendingBridges) {
      try {
        // Check if bridge is completed
        // This would require integration with bridge APIs or destination chain monitoring
        console.log(`Checking bridge ${bridge.sourceTxHash} from ${bridge.sourceChain} to ${bridge.destinationChain}`)
      } catch (error) {
        console.error(`Failed to check bridge status for ${bridge.sourceTxHash}:`, error)
      }
    }
  }

  /**
   * Get bridge statistics
   */
  static async getBridgeStats(): Promise<{
    totalBridges: number
    totalVolume: number
    bridgesByProtocol: Record<string, number>
    bridgesByRoute: Record<string, number>
    recentBridges: BridgeActivity[]
  }> {
    const { bridgeActivity } = await this.getCollections()

    const [
      totalBridges,
      totalVolume,
      protocolStats,
      routeStats,
      recentBridges
    ] = await Promise.all([
      bridgeActivity.countDocuments({}),
      bridgeActivity.aggregate([
        { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }
      ]).toArray(),
      bridgeActivity.aggregate([
        { $group: { _id: '$bridgeProtocol', count: { $sum: 1 } } }
      ]).toArray(),
      bridgeActivity.aggregate([
        { $group: { _id: { $concat: ['$sourceChain', '-', '$destinationChain'] }, count: { $sum: 1 } } }
      ]).toArray(),
      bridgeActivity.find({}).sort({ createdAt: -1 }).limit(10).toArray()
    ])

    const bridgesByProtocol: Record<string, number> = {}
    protocolStats.forEach(stat => {
      bridgesByProtocol[stat._id] = stat.count
    })

    const bridgesByRoute: Record<string, number> = {}
    routeStats.forEach(stat => {
      bridgesByRoute[stat._id] = stat.count
    })

    return {
      totalBridges,
      totalVolume: totalVolume[0]?.total || 0,
      bridgesByProtocol,
      bridgesByRoute,
      recentBridges
    }
  }

  /**
   * Detect suspicious bridge patterns
   */
  static async detectSuspiciousBridgePatterns(userAddress: string): Promise<{
    suspiciousPatterns: string[]
    riskScore: number
  }> {
    const { bridgeActivity } = await this.getCollections()

    const userBridges = await bridgeActivity
      .find({ userAddress })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const suspiciousPatterns: string[] = []
    let riskScore = 0

    // Pattern 1: Rapid bridge transactions
    const recentBridges = userBridges.filter(
      bridge => bridge.createdAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
    )
    
    if (recentBridges.length > 5) {
      suspiciousPatterns.push(`${recentBridges.length} bridge transactions in 24 hours`)
      riskScore += 25
    }

    // Pattern 2: Round-trip bridging (A->B->A)
    const chains = userBridges.map(b => `${b.sourceChain}-${b.destinationChain}`)
    for (let i = 0; i < chains.length - 1; i++) {
      const [sourceA, destA] = chains[i].split('-')
      const [sourceB, destB] = chains[i + 1].split('-')
      
      if (sourceA === destB && destA === sourceB) {
        suspiciousPatterns.push('Round-trip bridging pattern detected')
        riskScore += 20
        break
      }
    }

    // Pattern 3: Large amounts through uncommon routes
    const largeUncommonBridges = userBridges.filter(bridge => {
      const amount = parseFloat(bridge.amount)
      const route = `${bridge.sourceChain}-${bridge.destinationChain}`
      const uncommonRoutes = ['base-arbitrum', 'polygon-bsc', 'arbitrum-polygon']
      
      return amount > 50000 && uncommonRoutes.includes(route)
    })

    if (largeUncommonBridges.length > 0) {
      suspiciousPatterns.push('Large amounts through uncommon bridge routes')
      riskScore += 30
    }

    // Pattern 4: Failed bridge attempts
    const failedBridges = userBridges.filter(bridge => bridge.status === 'failed')
    if (failedBridges.length > 2) {
      suspiciousPatterns.push(`${failedBridges.length} failed bridge attempts`)
      riskScore += 15
    }

    return {
      suspiciousPatterns,
      riskScore: Math.min(100, riskScore)
    }
  }

  /**
   * Get bridge activity by chain
   */
  static async getChainBridgeActivity(chain: BlockchainType): Promise<{
    inbound: BridgeActivity[]
    outbound: BridgeActivity[]
    volume: { inbound: number; outbound: number }
  }> {
    const { bridgeActivity } = await this.getCollections()

    const [inbound, outbound] = await Promise.all([
      bridgeActivity.find({ destinationChain: chain }).sort({ createdAt: -1 }).limit(50).toArray(),
      bridgeActivity.find({ sourceChain: chain }).sort({ createdAt: -1 }).limit(50).toArray()
    ])

    const inboundVolume = inbound.reduce((sum, bridge) => sum + parseFloat(bridge.amount), 0)
    const outboundVolume = outbound.reduce((sum, bridge) => sum + parseFloat(bridge.amount), 0)

    return {
      inbound,
      outbound,
      volume: {
        inbound: inboundVolume,
        outbound: outboundVolume
      }
    }
  }
}