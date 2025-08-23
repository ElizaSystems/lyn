import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'
import { CryptoPaymentService } from '@/lib/services/crypto-payment-service'
import { InvoiceService } from '@/lib/services/invoice-service'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Initialize services
    const paymentService = CryptoPaymentService.getInstance(connection)

    // Get payment history
    const payments = await paymentService.getPaymentHistory(
      user.walletAddress,
      limit,
      offset
    )

    // Get invoices
    const invoices = await InvoiceService.getInvoicesForWallet(
      user.walletAddress,
      limit,
      offset
    )

    // Format payment history for response
    const formattedPayments = payments.map(payment => ({
      paymentReference: payment.paymentReference,
      amount: payment.amount,
      token: payment.token,
      amountUsd: payment.amountUsd,
      status: payment.status,
      description: payment.description,
      transactionSignature: payment.transactionSignature,
      confirmedAt: payment.confirmedAt?.toISOString(),
      failedAt: payment.failedAt?.toISOString(),
      failureReason: payment.failureReason,
      createdAt: payment.createdAt.toISOString(),
      retryCount: payment.retryCount
    }))

    // Format invoices for response
    const formattedInvoices = invoices.map(invoice => ({
      invoiceNumber: invoice.invoiceNumber,
      paymentReference: invoice.paymentReference,
      total: invoice.total,
      token: invoice.token,
      amountUsd: invoice.amountUsd,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      paidDate: invoice.paidDate?.toISOString(),
      items: invoice.items
    }))

    // Get payment statistics for this user
    const userStats = {
      totalPayments: payments.length,
      confirmedPayments: payments.filter(p => p.status === 'confirmed').length,
      totalSpent: {
        SOL: payments.filter(p => p.token === 'SOL' && p.status === 'confirmed')
          .reduce((sum, p) => sum + p.amount, 0),
        USDC: payments.filter(p => p.token === 'USDC' && p.status === 'confirmed')
          .reduce((sum, p) => sum + p.amount, 0)
      },
      successRate: payments.length > 0 
        ? (payments.filter(p => p.status === 'confirmed').length / payments.length) * 100 
        : 0
    }

    return NextResponse.json({
      success: true,
      payments: formattedPayments,
      invoices: formattedInvoices,
      pagination: {
        limit,
        offset,
        total: payments.length, // This would need to be actual total count in production
        hasMore: payments.length === limit
      },
      statistics: userStats
    })

  } catch (error) {
    console.error('Error fetching payment history:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    )
  }
}