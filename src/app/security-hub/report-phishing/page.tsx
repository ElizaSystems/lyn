'use client'

import { useState } from 'react'
import { 
  AlertTriangle, 
  Send, 
  Shield, 
  Link, 
  FileText,
  User,
  Globe,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRouter } from 'next/navigation'

interface PhishingReport {
  url?: string
  domain?: string
  description: string
  category: 'phishing' | 'scam' | 'malware' | 'impersonation' | 'other'
  evidence?: string
  reporterEmail?: string
}

export default function ReportPhishingPage() {
  const router = useRouter()
  const [report, setReport] = useState<PhishingReport>({
    description: '',
    category: 'phishing'
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!report.url && !report.domain) {
      setError('Please provide either a URL or domain to report')
      return
    }
    
    if (!report.description) {
      setError('Please provide a description of the threat')
      return
    }
    
    setSubmitting(true)
    setError('')
    
    try {
      const response = await fetch('/api/phishing-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(report)
      })
      
      if (response.ok) {
        setSubmitted(true)
        // Redirect after 3 seconds
        setTimeout(() => {
          router.push('/security-hub')
        }, 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to submit report')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-green-500/50">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold">Report Submitted Successfully!</h2>
                <p className="text-muted-foreground">
                  Thank you for helping keep the community safe. Your report will be reviewed by our security team.
                </p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to Security Hub...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Report Phishing/Scam</h1>
          </div>
          <p className="text-muted-foreground">
            Help protect the community by reporting malicious websites, phishing attempts, and scams
          </p>
        </div>

        {/* Report Form */}
        <Card>
          <CardHeader>
            <CardTitle>Submit Security Report</CardTitle>
            <CardDescription>
              All reports are reviewed by our security team and shared with the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* URL Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Malicious URL
                </label>
                <Input
                  placeholder="https://example-phishing-site.com"
                  value={report.url || ''}
                  onChange={(e) => setReport({ ...report, url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full URL of the suspicious website
                </p>
              </div>

              {/* Domain Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Or Domain Name
                </label>
                <Input
                  placeholder="phishing-site.com"
                  value={report.domain || ''}
                  onChange={(e) => setReport({ ...report, domain: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  If you don't have the full URL, provide the domain
                </p>
              </div>

              {/* Category Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Threat Category</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { value: 'phishing', label: '🎣 Phishing' },
                    { value: 'scam', label: '💸 Scam' },
                    { value: 'malware', label: '🦠 Malware' },
                    { value: 'impersonation', label: '🎭 Impersonation' },
                    { value: 'other', label: '❓ Other' }
                  ].map(({ value, label }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={report.category === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setReport({ ...report, category: value as any })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Description *
                </label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md bg-background"
                  placeholder="Describe why this is malicious (e.g., 'Impersonates MetaMask and asks for seed phrases')"
                  value={report.description}
                  onChange={(e) => setReport({ ...report, description: e.target.value })}
                  required
                />
              </div>

              {/* Evidence */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Additional Evidence (Optional)
                </label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md bg-background"
                  placeholder="Transaction hashes, screenshots URLs, or other evidence"
                  value={report.evidence || ''}
                  onChange={(e) => setReport({ ...report, evidence: e.target.value })}
                />
              </div>

              {/* Email (Optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Your Email (Optional)
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={report.reporterEmail || ''}
                  onChange={(e) => setReport({ ...report, reporterEmail: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Provide if you want updates on your report
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Report...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Report
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                What We Look For
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Fake crypto exchanges or wallets</li>
                <li>• Phishing sites stealing credentials</li>
                <li>• Impersonation of legitimate projects</li>
                <li>• Malware distribution sites</li>
                <li>• Investment scams and ponzis</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                How Reports Help
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Warns other users immediately</li>
                <li>• Adds to threat database</li>
                <li>• Improves AI detection</li>
                <li>• Shared with security partners</li>
                <li>• Helps take down malicious sites</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => router.push('/security-hub')}
          >
            Back to Security Hub
          </Button>
        </div>
      </div>
    </div>
  )
}