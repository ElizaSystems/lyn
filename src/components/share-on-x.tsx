'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Twitter, Check } from 'lucide-react'

interface ShareOnXProps {
  text: string
  hashtags?: string[]
  url?: string
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  successMessage?: string
  onShare?: () => void
}

export function ShareOnX({ 
  text, 
  hashtags = ['LYN', 'Solana'], 
  url = 'https://lyn.ai',
  className = '',
  variant = 'default',
  size = 'default',
  successMessage = 'Shared on X!',
  onShare
}: ShareOnXProps) {
  const [shared, setShared] = useState(false)

  const handleShare = () => {
    const encodedText = encodeURIComponent(text)
    const encodedHashtags = hashtags.join(',')
    const encodedUrl = encodeURIComponent(url)
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&hashtags=${encodedHashtags}&url=${encodedUrl}`
    
    window.open(twitterUrl, '_blank', 'width=550,height=420')
    
    setShared(true)
    setTimeout(() => setShared(false), 3000)
    
    if (onShare) {
      onShare()
    }
  }

  return (
    <Button
      onClick={handleShare}
      variant={variant}
      size={size}
      className={`flex items-center gap-2 ${className}`}
    >
      {shared ? (
        <>
          <Check className="h-4 w-4" />
          {successMessage}
        </>
      ) : (
        <>
          <Twitter className="h-4 w-4" />
          Flex on X
        </>
      )}
    </Button>
  )
}