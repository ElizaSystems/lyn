import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Read the litepaper markdown file
    const filePath = path.join(process.cwd(), 'LITEPAPER.md')
    const content = await fs.readFile(filePath, 'utf8')
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error reading litepaper:', error)
    return NextResponse.json(
      { error: 'Failed to load litepaper' },
      { status: 500 }
    )
  }
}