import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { TaskExecutor, TaskTemplate } from '@/lib/services/task-executor'
import { TaskTemplateLibrary } from '@/lib/services/task-templates'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const popular = searchParams.get('popular') === 'true'
    
    let templates: TaskTemplate[]
    
    if (popular) {
      templates = await TaskTemplateLibrary.getPopularTemplates(10)
    } else if (category) {
      templates = await TaskTemplateLibrary.getTemplatesByCategory(category)
    } else {
      templates = await TaskExecutor.getTaskTemplates({
        type: type as any,
        category: category || undefined,
        isPublic: true
      })
    }
    
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Templates GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error.message },
      { status: authResult.error.status }
    )
  }

  try {
    const body = await req.json()
    
    if (body.action === 'create') {
      const template = await TaskExecutor.createTaskTemplate({
        name: body.name,
        description: body.description,
        type: body.type,
        defaultConfig: body.defaultConfig || {},
        requiredFields: body.requiredFields || [],
        optionalFields: body.optionalFields || [],
        defaultFrequency: body.defaultFrequency || 'Daily',
        category: body.category,
        tags: body.tags || [],
        isPublic: body.isPublic || false,
        createdBy: authResult.user.id
      })
      
      return NextResponse.json({ template })
    }
    
    if (body.action === 'create-task-from-template') {
      const result = await TaskTemplateLibrary.createTaskFromTemplateGuided(
        body.templateId,
        authResult.user.id,
        {
          name: body.taskName,
          customConfig: body.config,
          frequency: body.frequency,
          cronExpression: body.cronExpression,
          priority: body.priority,
          dependencies: body.dependencies,
          retryConfig: body.retryConfig
        }
      )
      
      if (result.task) {
        return NextResponse.json({
          success: true,
          task: result.task,
          recommendations: result.recommendations
        })
      } else {
        return NextResponse.json({
          success: false,
          missingRequiredFields: result.missingRequiredFields,
          recommendations: result.recommendations
        }, { status: 400 })
      }
    }
    
    if (body.action === 'get-template-schema') {
      const templates = await TaskExecutor.getTaskTemplates()
      const template = templates.find(t => t._id?.toString() === body.templateId)
      
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      
      const schema = TaskTemplateLibrary.getTemplateConfigSchema(template)
      return NextResponse.json({ schema, template })
    }
    
    if (body.action === 'initialize-defaults') {
      await TaskTemplateLibrary.initializeDefaultTemplates()
      return NextResponse.json({ success: true, message: 'Default templates initialized' })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json({ error: 'Failed to process template action' }, { status: 500 })
  }
}