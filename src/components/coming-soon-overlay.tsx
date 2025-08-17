'use client'
import { Clock, Zap } from 'lucide-react'

interface ComingSoonOverlayProps {
  title?: string
  description?: string
  children?: React.ReactNode
}

export function ComingSoonOverlay({ 
  title = "Coming Soon",
  description = "This feature is currently under development and will be available soon.",
  children 
}: ComingSoonOverlayProps) {
  return (
    <div className="relative min-h-screen">
      {/* Content that will be blurred */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>
      
      {/* Semi-opaque overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 mb-6">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          
          <h2 className="text-3xl font-bold text-foreground mb-4">
            {title}
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            {description}
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-primary" />
            <span>Building the future of AI-powered trading</span>
          </div>
          
          <div className="mt-6 pt-6 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Want updates? Follow our development progress on GitHub
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}