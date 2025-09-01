import { NextRequest, NextResponse } from 'next/server'
import { TelegramWalletService } from '@/lib/services/telegram-wallet'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { 
      telegramId, 
      walletAddress, 
      signature, 
      linkingCode,
      initData 
    } = await request.json()

    // Verify Telegram Web App data if provided
    if (initData) {
      const secret = crypto
        .createHmac('sha256', 'WebAppData')
        .update(process.env.TELEGRAM_BOT_TOKEN || '')
        .digest()

      const checkString = Object.entries(initData)
        .filter(([key]) => key !== 'hash')
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('\n')

      const hash = crypto
        .createHmac('sha256', secret)
        .update(checkString)
        .digest('hex')

      if (hash !== initData.hash) {
        return NextResponse.json(
          { error: 'Invalid Telegram authentication' },
          { status: 401 }
        )
      }
    }

    // Link the wallet
    const result = await TelegramWalletService.linkWallet(
      telegramId,
      walletAddress,
      signature,
      linkingCode
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        walletAddress
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Wallet linking error:', error)
    return NextResponse.json(
      { error: 'Failed to link wallet' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { telegramId } = await request.json()

    const result = await TelegramWalletService.unlinkWallet(telegramId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Wallet unlinking error:', error)
    return NextResponse.json(
      { error: 'Failed to unlink wallet' },
      { status: 500 }
    )
  }
}