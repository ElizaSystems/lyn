import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { 
  PaymentInvoice, 
  PaymentTransaction, 
  PaymentToken, 
  Subscription 
} from '@/lib/models/subscription'
import crypto from 'crypto'

export class InvoiceService {
  /**
   * Generate unique invoice number
   */
  private static generateInvoiceNumber(): string {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const random = crypto.randomBytes(3).toString('hex').toUpperCase()
    
    return `LYN-${year}${month}${day}-${random}`
  }

  /**
   * Create invoice for a payment transaction
   */
  static async createInvoice(
    payment: PaymentTransaction,
    subscription: Subscription,
    customerInfo: {
      walletAddress: string
      username?: string
      email?: string
    }
  ): Promise<PaymentInvoice> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const issueDate = new Date()
    const dueDate = new Date(issueDate)
    dueDate.setDate(dueDate.getDate() + 30) // 30 days payment terms

    // Create invoice items
    const items = [
      {
        description: `${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)} Subscription (${subscription.billingCycle})`,
        quantity: 1,
        unitPrice: payment.amount,
        token: payment.token,
        total: payment.amount
      }
    ]

    // Calculate fees if applicable
    let fees = 0
    if (payment.platformFee) {
      fees += payment.platformFee
    }
    if (payment.referralFees) {
      fees += payment.referralFees.tier1 + payment.referralFees.tier2
    }

    const invoice: PaymentInvoice = {
      invoiceNumber: this.generateInvoiceNumber(),
      paymentReference: payment.paymentReference,
      subscriptionId: subscription._id!,
      transactionId: payment._id!,
      walletAddress: payment.walletAddress,
      customerInfo,
      items,
      subtotal: payment.amount,
      fees,
      total: payment.amount,
      token: payment.token,
      amountUsd: payment.amountUsd,
      issueDate,
      dueDate,
      paidDate: payment.confirmedAt,
      status: payment.confirmedAt ? 'paid' : 'sent',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await invoicesCollection.insertOne(invoice)
    return { ...invoice, _id: result.insertedId }
  }

  /**
   * Get invoice by invoice number
   */
  static async getInvoiceByNumber(invoiceNumber: string): Promise<PaymentInvoice | null> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const invoice = await invoicesCollection.findOne({ invoiceNumber })
    return invoice as PaymentInvoice | null
  }

  /**
   * Get invoice by payment reference
   */
  static async getInvoiceByPaymentReference(paymentReference: string): Promise<PaymentInvoice | null> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const invoice = await invoicesCollection.findOne({ paymentReference })
    return invoice as PaymentInvoice | null
  }

  /**
   * Get all invoices for a wallet
   */
  static async getInvoicesForWallet(
    walletAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaymentInvoice[]> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const invoices = await invoicesCollection
      .find({ walletAddress })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return invoices as unknown as PaymentInvoice[]
  }

  /**
   * Update invoice status
   */
  static async updateInvoiceStatus(
    invoiceNumber: string,
    status: PaymentInvoice['status'],
    paidDate?: Date
  ): Promise<boolean> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    if (paidDate && status === 'paid') {
      updateData.paidDate = paidDate
    }

    const result = await invoicesCollection.updateOne(
      { invoiceNumber },
      { $set: updateData }
    )

    return result.modifiedCount > 0
  }

  /**
   * Generate invoice PDF data (simplified - returns structured data for PDF generation)
   */
  static async generateInvoicePDFData(invoiceNumber: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const invoice = await this.getInvoiceByNumber(invoiceNumber)
      if (!invoice) {
        return { success: false, error: 'Invoice not found' }
      }

      const pdfData = {
        invoice: {
          number: invoice.invoiceNumber,
          issueDate: invoice.issueDate.toISOString().split('T')[0],
          dueDate: invoice.dueDate.toISOString().split('T')[0],
          paidDate: invoice.paidDate ? invoice.paidDate.toISOString().split('T')[0] : null,
          status: invoice.status
        },
        company: {
          name: 'LYN AI Platform',
          address: 'Decentralized Web3 Platform',
          email: 'support@lyn.ai',
          website: 'https://lyn.ai'
        },
        customer: {
          name: invoice.customerInfo.username || 'Unnamed User',
          walletAddress: invoice.customerInfo.walletAddress,
          email: invoice.customerInfo.email || 'Not provided'
        },
        items: invoice.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: `${item.unitPrice} ${item.token}`,
          total: `${item.total} ${item.token}`
        })),
        totals: {
          subtotal: `${invoice.subtotal} ${invoice.token}`,
          fees: `${invoice.fees} ${invoice.token}`,
          total: `${invoice.total} ${invoice.token}`,
          totalUsd: invoice.amountUsd ? `$${invoice.amountUsd.toFixed(2)} USD` : 'N/A'
        },
        payment: {
          method: 'Cryptocurrency',
          token: invoice.token,
          reference: invoice.paymentReference
        }
      }

      return { success: true, data: pdfData }

    } catch (error) {
      console.error('Error generating invoice PDF data:', error)
      return { 
        success: false, 
        error: `Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Get invoice statistics
   */
  static async getInvoiceStatistics(): Promise<{
    totalInvoices: number
    paidInvoices: number
    unpaidInvoices: number
    overdueInvoices: number
    totalRevenue: { [key in PaymentToken]: number }
    averageInvoiceValue: { [key in PaymentToken]: number }
  }> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const now = new Date()

    const [
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices
    ] = await Promise.all([
      invoicesCollection.countDocuments({}),
      invoicesCollection.countDocuments({ status: 'paid' }),
      invoicesCollection.countDocuments({ 
        status: { $in: ['sent', 'draft'] } 
      }),
      invoicesCollection.countDocuments({ 
        status: { $in: ['sent'] },
        dueDate: { $lt: now }
      })
    ])

    // Calculate revenue by token
    const revenueAggregation = await invoicesCollection.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: '$token',
          totalRevenue: { $sum: '$total' },
          averageValue: { $avg: '$total' },
          count: { $sum: 1 }
        }
      }
    ]).toArray()

    const totalRevenue = { [PaymentToken.SOL]: 0, [PaymentToken.USDC]: 0 }
    const averageInvoiceValue = { [PaymentToken.SOL]: 0, [PaymentToken.USDC]: 0 }

    revenueAggregation.forEach(item => {
      totalRevenue[item._id as PaymentToken] = item.totalRevenue
      averageInvoiceValue[item._id as PaymentToken] = item.averageValue
    })

    return {
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalRevenue,
      averageInvoiceValue
    }
  }

  /**
   * Mark overdue invoices
   */
  static async markOverdueInvoices(): Promise<number> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const now = new Date()

    const result = await invoicesCollection.updateMany(
      {
        status: 'sent',
        dueDate: { $lt: now }
      },
      {
        $set: {
          status: 'overdue',
          updatedAt: now
        }
      }
    )

    console.log(`[Invoice Service] Marked ${result.modifiedCount} invoices as overdue`)
    return result.modifiedCount
  }

  /**
   * Generate monthly invoice summary
   */
  static async generateMonthlySummary(
    year: number,
    month: number
  ): Promise<{
    period: string
    totalInvoices: number
    totalRevenue: { [key in PaymentToken]: number }
    paymentMethods: { [key: string]: number }
    topCustomers: Array<{
      walletAddress: string
      username?: string
      totalSpent: number
      token: PaymentToken
      invoiceCount: number
    }>
  }> {
    const db = await getDatabase()
    const invoicesCollection = db.collection('payment_invoices')

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // Get invoices for the period
    const invoices = await invoicesCollection
      .find({
        status: 'paid',
        paidDate: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .toArray()

    const totalInvoices = invoices.length

    // Calculate revenue by token
    const totalRevenue = { [PaymentToken.SOL]: 0, [PaymentToken.USDC]: 0 }
    const paymentMethods: { [key: string]: number } = {}

    invoices.forEach(invoice => {
      totalRevenue[invoice.token as PaymentToken] += invoice.total
      paymentMethods[invoice.token] = (paymentMethods[invoice.token] || 0) + 1
    })

    // Get top customers
    const customerAggregation = await invoicesCollection.aggregate([
      {
        $match: {
          status: 'paid',
          paidDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            walletAddress: '$walletAddress',
            token: '$token'
          },
          totalSpent: { $sum: '$total' },
          invoiceCount: { $sum: 1 },
          username: { $first: '$customerInfo.username' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]).toArray()

    const topCustomers = customerAggregation.map(customer => ({
      walletAddress: customer._id.walletAddress,
      username: customer.username,
      totalSpent: customer.totalSpent,
      token: customer._id.token,
      invoiceCount: customer.invoiceCount
    }))

    return {
      period: `${year}-${month.toString().padStart(2, '0')}`,
      totalInvoices,
      totalRevenue,
      paymentMethods,
      topCustomers
    }
  }
}