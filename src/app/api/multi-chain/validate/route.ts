import { NextRequest, NextResponse } from 'next/server'
import { AddressValidationService } from '@/lib/services/address-validation'
import { BlockchainType } from '@/lib/models/multi-chain'

/**
 * POST /api/multi-chain/validate - Validate addresses across multiple chains
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, chain, addresses } = body

    // Single address validation
    if (address && chain) {
      if (!AddressValidationService) {
        return NextResponse.json(
          { success: false, error: 'Address validation service not available' },
          { status: 500 }
        )
      }

      const validChains = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base']
      if (!validChains.includes(chain)) {
        return NextResponse.json(
          { success: false, error: `Invalid chain: ${chain}. Valid chains: ${validChains.join(', ')}` },
          { status: 400 }
        )
      }

      const validation = AddressValidationService.validateAndNormalize(address, chain as BlockchainType)

      return NextResponse.json({
        success: true,
        data: validation
      })
    }

    // Multiple address validation
    if (Array.isArray(addresses)) {
      const validations = addresses.map(({ address, chain }) => {
        try {
          const validation = AddressValidationService.validateAndNormalize(address, chain as BlockchainType)
          return {
            address,
            chain,
            ...validation
          }
        } catch (error) {
          return {
            address,
            chain,
            originalAddress: address,
            normalizedAddress: address,
            validation: {
              address,
              chain,
              isValid: false,
              format: 'unknown',
              errorMessage: error instanceof Error ? error.message : 'Validation failed'
            },
            format: {
              format: 'unknown',
              length: address?.length || 0,
              encoding: 'Unknown',
              description: 'Validation failed'
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          validations,
          summary: {
            total: validations.length,
            valid: validations.filter(v => v.validation.isValid).length,
            invalid: validations.filter(v => !v.validation.isValid).length
          }
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Either (address, chain) or addresses array is required' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Address Validation] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/multi-chain/validate - Get validation info or detect chain from address
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const address = url.searchParams.get('address')
    const detect = url.searchParams.get('detect') === 'true'

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
        { status: 400 }
      )
    }

    if (detect) {
      // Detect possible chains for the address
      const possibleChains = AddressValidationService.detectChainFromAddress(address)
      
      const validations = possibleChains.map(chain => {
        try {
          return AddressValidationService.validateAndNormalize(address, chain)
        } catch (error) {
          return {
            originalAddress: address,
            normalizedAddress: address,
            validation: {
              address,
              chain,
              isValid: false,
              format: 'unknown',
              errorMessage: error instanceof Error ? error.message : 'Validation failed'
            },
            format: {
              format: 'unknown',
              length: address.length,
              encoding: 'Unknown',
              description: 'Validation failed'
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          address,
          possibleChains,
          validations,
          recommendation: validations.find(v => v.validation.isValid)?.validation.chain || null
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Detection mode required. Use ?detect=true' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Address Detection] GET error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}