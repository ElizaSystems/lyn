import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    console.log(`[Manual Burn] Adding manual burn record`)
    
    const { walletAddress, username, amount, type = 'username_registration' } = await request.json()
    
    if (!walletAddress || !amount) {
      return NextResponse.json({ 
        error: 'walletAddress and amount are required' 
      }, { status: 400 })
    }

    const db = await getDatabase()
    const burnsCollection = db.collection('burns')
    
    // Check if burn already exists
    const existing = await burnsCollection.findOne({ 
      walletAddress, 
      type: 'username_registration',
      amount: parseInt(amount)
    })
    
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Burn already exists',
        burn: existing
      })
    }
    
    const burnRecord = {
      walletAddress,
      username: username || undefined,
      amount: parseInt(amount),
      type,
      transactionSignature: `manual_${Date.now()}`,
      description: username ? `Username registration: @${username}` : 'Manual burn entry',
      metadata: {
        manual: true
      },
      timestamp: new Date(),
      verified: true
    }
    
    const result = await burnsCollection.insertOne(burnRecord)
    console.log(`[Manual Burn] Added burn with ID: ${result.insertedId}`)
    
    return NextResponse.json({
      success: true,
      burn: { ...burnRecord, _id: result.insertedId },
      message: 'Burn added successfully'
    })
    
  } catch (error) {
    console.error('Manual burn add error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add manual burn'
    }, { status: 200 })
  }
}