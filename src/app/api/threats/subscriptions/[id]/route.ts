import { NextRequest, NextResponse } from 'next/server'
import { ThreatSubscriptionService } from '@/lib/services/threat-subscription-service'
import { authenticateUser } from '@/lib/middleware/auth'
import { ObjectId } from 'mongodb'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const subscriptionId = params.id

    if (!ObjectId.isValid(subscriptionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription ID' },
        { status: 400 }
      )
    }

    const subscription = await ThreatSubscriptionService.getSubscription(subscriptionId)

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this subscription
    const authResult = await authenticateUser(request)
    if (subscription.userId && (!authResult.success || !authResult.user || 
        authResult.user._id!.toString() !== subscription.userId.toString())) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        subscription
      }
    })

  } catch (error) {
    logger.error(`[API] Failed to get subscription ${params.id}:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const subscriptionId = params.id
    const body = await request.json()

    if (!ObjectId.isValid(subscriptionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription ID' },
        { status: 400 }
      )
    }

    // Check ownership
    const authResult = await authenticateUser(request)
    const existingSubscription = await ThreatSubscriptionService.getSubscription(subscriptionId)
    
    if (!existingSubscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      )
    }

    if (existingSubscription.userId && (!authResult.success || !authResult.user || 
        authResult.user._id!.toString() !== existingSubscription.userId.toString())) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const updatedSubscription = await ThreatSubscriptionService.updateSubscription(subscriptionId, body)

    if (!updatedSubscription) {
      return NextResponse.json(
        { success: false, error: 'Update failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        subscription: updatedSubscription,
        message: 'Subscription updated successfully'
      }
    })

  } catch (error) {
    logger.error(`[API] Failed to update subscription ${params.id}:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const subscriptionId = params.id

    if (!ObjectId.isValid(subscriptionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription ID' },
        { status: 400 }
      )
    }

    // Check ownership
    const authResult = await authenticateUser(request)
    const existingSubscription = await ThreatSubscriptionService.getSubscription(subscriptionId)
    
    if (!existingSubscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      )
    }

    if (existingSubscription.userId && (!authResult.success || !authResult.user || 
        authResult.user._id!.toString() !== existingSubscription.userId.toString())) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const success = await ThreatSubscriptionService.deleteSubscription(subscriptionId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Delete failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Subscription deleted successfully'
      }
    })

  } catch (error) {
    logger.error(`[API] Failed to delete subscription ${params.id}:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}