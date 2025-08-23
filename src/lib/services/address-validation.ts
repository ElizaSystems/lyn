import { ethers } from 'ethers'
import { PublicKey } from '@solana/web3.js'
import { BlockchainType, AddressValidation } from '@/lib/models/multi-chain'

/**
 * Address validation service for multiple blockchains
 */
export class AddressValidationService {
  /**
   * Validate Solana address
   */
  static validateSolanaAddress(address: string): AddressValidation {
    try {
      const publicKey = new PublicKey(address)
      const isValid = PublicKey.isOnCurve(publicKey.toBuffer())
      
      return {
        address,
        chain: 'solana',
        isValid,
        format: 'base58'
      }
    } catch (error) {
      return {
        address,
        chain: 'solana',
        isValid: false,
        format: 'base58',
        errorMessage: error instanceof Error ? error.message : 'Invalid Solana address'
      }
    }
  }

  /**
   * Validate EVM address (Ethereum, BSC, Polygon, Arbitrum, Base)
   */
  static validateEvmAddress(address: string, chain: BlockchainType): AddressValidation {
    try {
      if (!ethers.isAddress(address)) {
        return {
          address,
          chain,
          isValid: false,
          format: 'hex',
          errorMessage: 'Invalid EVM address format'
        }
      }

      // Check if it's a checksummed address
      const isChecksummed = address === ethers.getAddress(address)
      
      return {
        address,
        chain,
        isValid: true,
        format: isChecksummed ? 'hex-checksummed' : 'hex'
      }
    } catch (error) {
      return {
        address,
        chain,
        isValid: false,
        format: 'hex',
        errorMessage: error instanceof Error ? error.message : 'Invalid EVM address'
      }
    }
  }

  /**
   * Validate address for any supported chain
   */
  static validateAddress(address: string, chain: BlockchainType): AddressValidation {
    if (chain === 'solana') {
      return this.validateSolanaAddress(address)
    } else if (['ethereum', 'bsc', 'polygon', 'arbitrum', 'base'].includes(chain)) {
      return this.validateEvmAddress(address, chain)
    } else {
      return {
        address,
        chain,
        isValid: false,
        format: 'unknown',
        errorMessage: `Unsupported chain: ${chain}`
      }
    }
  }

  /**
   * Normalize address format
   */
  static normalizeAddress(address: string, chain: BlockchainType): string {
    const validation = this.validateAddress(address, chain)
    
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid address')
    }

    if (chain === 'solana') {
      // Solana addresses are already in the correct format
      return address
    } else if (['ethereum', 'bsc', 'polygon', 'arbitrum', 'base'].includes(chain)) {
      // Return checksummed EVM address
      return ethers.getAddress(address)
    }

    return address
  }

  /**
   * Check if two addresses are the same (accounting for format differences)
   */
  static addressesEqual(address1: string, address2: string, chain: BlockchainType): boolean {
    try {
      const normalized1 = this.normalizeAddress(address1, chain)
      const normalized2 = this.normalizeAddress(address2, chain)
      return normalized1.toLowerCase() === normalized2.toLowerCase()
    } catch {
      // If normalization fails, do direct comparison
      return address1.toLowerCase() === address2.toLowerCase()
    }
  }

  /**
   * Detect chain type from address format
   */
  static detectChainFromAddress(address: string): BlockchainType[] {
    const possibleChains: BlockchainType[] = []

    // Check if it's a valid Solana address
    try {
      new PublicKey(address)
      if (address.length >= 32 && address.length <= 44) {
        possibleChains.push('solana')
      }
    } catch {
      // Not a Solana address
    }

    // Check if it's a valid EVM address
    if (ethers.isAddress(address)) {
      possibleChains.push('ethereum', 'bsc', 'polygon', 'arbitrum', 'base')
    }

    return possibleChains
  }

  /**
   * Validate multiple addresses
   */
  static validateAddresses(
    addresses: Array<{ address: string; chain: BlockchainType }>
  ): AddressValidation[] {
    return addresses.map(({ address, chain }) => 
      this.validateAddress(address, chain)
    )
  }

  /**
   * Check if address is likely a contract (for EVM chains)
   */
  static isLikelyContract(address: string): boolean {
    // Simple heuristics for contract detection
    if (!ethers.isAddress(address)) {
      return false
    }

    // Check for common contract patterns
    const normalizedAddress = address.toLowerCase()
    
    // Null address
    if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
      return true
    }

    // Common token contract patterns (this is basic, would need on-chain check for certainty)
    // This is just a placeholder - in practice you'd query the blockchain
    return false
  }

  /**
   * Get address format information
   */
  static getAddressFormat(address: string, chain: BlockchainType): {
    format: string
    length: number
    encoding: string
    description: string
  } {
    if (chain === 'solana') {
      return {
        format: 'base58',
        length: address.length,
        encoding: 'Base58',
        description: 'Solana public key encoded in Base58'
      }
    } else if (['ethereum', 'bsc', 'polygon', 'arbitrum', 'base'].includes(chain)) {
      return {
        format: 'hex',
        length: address.length,
        encoding: 'Hexadecimal',
        description: 'EVM address in hexadecimal format (20 bytes)'
      }
    }

    return {
      format: 'unknown',
      length: address.length,
      encoding: 'Unknown',
      description: 'Unknown address format'
    }
  }

  /**
   * Validate and normalize address with detailed result
   */
  static validateAndNormalize(address: string, chain: BlockchainType): {
    originalAddress: string
    normalizedAddress: string
    validation: AddressValidation
    format: ReturnType<typeof AddressValidationService.getAddressFormat>
  } {
    const validation = this.validateAddress(address, chain)
    let normalizedAddress = address

    try {
      if (validation.isValid) {
        normalizedAddress = this.normalizeAddress(address, chain)
      }
    } catch (error) {
      // Keep original address if normalization fails
    }

    const format = this.getAddressFormat(address, chain)

    return {
      originalAddress: address,
      normalizedAddress,
      validation,
      format
    }
  }
}