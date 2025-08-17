'use client'
import { useState, useEffect } from 'react'
import { FileText, Download, ExternalLink, Copy, Check } from 'lucide-react'
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
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">LYN AI Litepaper</h1>
                <p className="text-sm text-muted-foreground">Protecting the Decentralized Future Through AI-Powered Security</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Share'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPDF}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              
              <Button
                size="sm"
                className="flex items-center gap-2"
                onClick={() => window.open('https://github.com/lyn-ai', '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="glass-card p-8 rounded-xl border border-border/50">
          <div 
            className="prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: `<p class="mb-4">${markdownToHtml(markdownContent)}</p>` 
            }}
          />
        </div>
        
        {/* Footer */}
        <div className="mt-8 p-6 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-2">Stay Connected</h3>
              <p className="text-sm text-muted-foreground">
                Join our community for the latest updates and security insights
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                Discord
              </Button>
              <Button variant="outline" size="sm">
                Twitter
              </Button>
              <Button variant="outline" size="sm">
                Telegram
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}