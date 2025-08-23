import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { NotificationTemplateService } from '@/lib/services/notification-templates'

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await requireAdmin(request)
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.error.message }, { status: adminResult.error.status })
    }

    const startTime = Date.now()
    
    // Initialize default templates
    await NotificationTemplateService.initializeDefaultTemplates()
    
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Notification templates initialized successfully',
      duration: `${duration}ms`
    })
  } catch (error) {
    console.error('Error initializing notification templates:', error)
    return NextResponse.json({ 
      error: 'Failed to initialize notification templates',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await requireAdmin(request)
    if (adminResult.error) {
      return NextResponse.json({ error: adminResult.error.message }, { status: adminResult.error.status })
    }

    const startTime = Date.now()
    
    // Update existing templates
    await NotificationTemplateService.updateTemplates()
    
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Notification templates updated successfully',
      duration: `${duration}ms`
    })
  } catch (error) {
    console.error('Error updating notification templates:', error)
    return NextResponse.json({ 
      error: 'Failed to update notification templates',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}