'use client'
import { useState, useEffect } from 'react'
import { FileText, Download, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LitepaperPage() {
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Fetch the markdown content
    fetch('/api/litepaper')
      .then(response => response.text())
      .then(content => {
        setMarkdownContent(content)
        setLoading(false)
      })
      .catch(error => {
        console.error('Failed to load litepaper:', error)
        setLoading(false)
      })
  }, [])

  const copyToClipboard = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadPDF = () => {
    if (typeof window !== 'undefined') {
      // In a real implementation, you'd generate a PDF
      // For now, we'll just download the markdown
      const blob = new Blob([markdownContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'LYN-AI-Litepaper-v1.0.md'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  // Convert markdown to HTML (basic conversion)
  const markdownToHtml = (markdown: string) => {
    return markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mb-4 text-primary">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mb-6 text-foreground border-b border-border pb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold mb-8 text-foreground">$1</h1>')
      
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code class="bg-muted px-2 py-1 rounded text-sm">$1</code>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      
      // Bold and italic
      .replace(/\*\*([^*]+)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      .replace(/\*([^*]+)\*/gim, '<em class="italic">$1</em>')
      
      // Lists
      .replace(/^- (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li class="ml-4">$1. $2</li>')
      
      // Paragraphs
      .replace(/^\s*$/gim, '</p><p class="mb-4">')
      .replace(/^([^<\n].*$)/gim, '$1<br/>')
      
      // Clean up
      .replace(/<br\/>\s*<\/p>/gim, '</p>')
      .replace(/<p class="mb-4"><\/p>/gim, '')
      .replace(/<br\/>\s*<br\/>/gim, '</p><p class="mb-4">')
  }

  if (loading) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          <span className="text-muted-foreground">Loading litepaper...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold truncate">LYN AI Litepaper</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Protecting the Decentralized Future Through AI-Powered Security</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
              >
                {copied ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPDF}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="glass-card p-4 sm:p-6 lg:p-8 rounded-xl border border-border/50">
          <div 
            className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base lg:prose-lg"
            dangerouslySetInnerHTML={{ 
              __html: `<p class="mb-4">${markdownToHtml(markdownContent)}</p>` 
            }}
          />
        </div>
        
      </div>
    </div>
  )
}