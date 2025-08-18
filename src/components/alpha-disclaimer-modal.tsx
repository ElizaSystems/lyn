'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function AlphaDisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAccepted, setIsAccepted] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)

  useEffect(() => {
    // Check if user has already accepted the disclaimer
    const hasAccepted = localStorage.getItem('alpha-disclaimer-accepted')
    if (!hasAccepted) {
      setIsOpen(true)
    }
  }, [])

  const handleAccept = () => {
    if (!termsChecked) {
      alert('Please accept the terms and conditions to continue.')
      return
    }
    
    localStorage.setItem('alpha-disclaimer-accepted', 'true')
    setIsAccepted(true)
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-card max-w-2xl w-full rounded-xl border border-border shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Alpha Version Disclaimer</h2>
              <p className="text-sm text-muted-foreground">Important: Please read carefully before proceeding</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Alpha Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-yellow-500">This is an ALPHA version</p>
                <p className="text-muted-foreground">
                  LYN AI Security Platform is currently in alpha testing. This means:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  <li>Features may contain bugs or unexpected behavior</li>
                  <li>Security scans may not detect all threats</li>
                  <li>The platform may experience downtime or data loss</li>
                  <li>APIs and features are subject to change without notice</li>
                  <li>Performance may be inconsistent or degraded</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-primary">Security & Risk Notice</p>
                <p className="text-muted-foreground">
                  While LYN AI provides security analysis and threat detection:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  <li>We cannot guarantee 100% threat detection accuracy</li>
                  <li>You should never rely solely on automated security tools</li>
                  <li>Always verify security alerts independently</li>
                  <li>Maintain your own security best practices</li>
                  <li>Keep your private keys and seed phrases secure</li>
                </ul>
              </div>
            </div>
          </div>

          {/* DYOR & NFA */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Do Your Own Research (DYOR)</p>
                <p className="text-muted-foreground">
                  All information provided by LYN AI is for informational purposes only. 
                  Always conduct your own research and due diligence before making any 
                  decisions regarding your crypto assets.
                </p>
              </div>
              
              <div>
                <p className="font-semibold mb-1">Not Financial Advice (NFA)</p>
                <p className="text-muted-foreground">
                  Nothing on this platform constitutes financial, investment, legal, or tax advice. 
                  LYN AI is a security tool and should not be used as the sole basis for any 
                  financial decisions.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">No Liability</p>
                <p className="text-muted-foreground">
                  By using this platform, you acknowledge that LYN AI and its developers are not 
                  responsible for any losses, damages, or security breaches that may occur.
                </p>
              </div>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="bg-background border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms-accept"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="terms-accept" className="text-sm text-muted-foreground cursor-pointer">
                I acknowledge that this is an alpha version with potential flaws. I understand the 
                importance of doing my own research (DYOR) and that nothing here constitutes 
                financial advice (NFA). I have read and accept the{' '}
                <Link href="/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                  <ExternalLink className="w-3 h-3 inline ml-1" />
                </Link>
                .
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              By proceeding, you accept all risks associated with using alpha software.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = 'https://google.com'}
              >
                Decline & Leave
              </Button>
              <Button 
                onClick={handleAccept}
                disabled={!termsChecked}
                className="bg-primary hover:bg-primary/90"
              >
                I Understand & Accept
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}