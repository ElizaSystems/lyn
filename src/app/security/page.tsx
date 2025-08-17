'use client'
import { Shield, MessageCircle, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import { SecurityChat } from '@/components/security/security-chat'

export default function SecurityPage() {
  const features = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: "AI-Powered Analysis",
      description: "Advanced threat detection using machine learning algorithms"
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: "Interactive Chat",
      description: "Ask questions and get instant security insights"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Real-time Scanning",
      description: "Continuous monitoring of links, documents, and contracts"
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "Threat Intelligence",
      description: "Stay informed about the latest security threats and vulnerabilities"
    }
  ]

  const recentScans = [
    {
      type: "URL",
      target: "suspicious-dex.com",
      result: "UNSAFE",
      riskLevel: "HIGH",
      timestamp: "2 minutes ago"
    },
    {
      type: "Document",
      target: "whitepaper.pdf",
      result: "SAFE",
      riskLevel: "LOW",
      timestamp: "15 minutes ago"
    },
    {
      type: "Contract",
      target: "0x742d...3f8a",
      result: "SAFE",
      riskLevel: "LOW",
      timestamp: "1 hour ago"
    }
  ]

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'text-red-500'
      case 'MEDIUM':
        return 'text-yellow-500'
      case 'LOW':
        return 'text-green-500'
      default:
        return 'text-muted-foreground'
    }
  }

  const getResultIcon = (result: string) => {
    return result === 'SAFE' 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <AlertTriangle className="w-4 h-4 text-red-500" />
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Security Assistant</h1>
            <p className="text-muted-foreground">AI-powered security analysis and threat detection</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chat Interface */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="flex items-center gap-2 mb-6">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Chat with Security AI</h2>
            </div>
            <SecurityChat />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Features */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Key Features</h3>
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Scans */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
            <div className="space-y-3">
              {recentScans.map((scan, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-sidebar/30">
                  <div className="flex items-center gap-3">
                    {getResultIcon(scan.result)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{scan.type}</span>
                        <span className={`text-xs ${getRiskColor(scan.riskLevel)}`}>
                          {scan.riskLevel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {scan.target}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {scan.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left p-3 rounded-lg bg-sidebar/30 hover:bg-sidebar/50 transition-colors">
                <div className="text-sm font-medium">Scan URL</div>
                <div className="text-xs text-muted-foreground">Check if a link is safe</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg bg-sidebar/30 hover:bg-sidebar/50 transition-colors">
                <div className="text-sm font-medium">Analyze Document</div>
                <div className="text-xs text-muted-foreground">Upload and scan files</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg bg-sidebar/30 hover:bg-sidebar/50 transition-colors">
                <div className="text-sm font-medium">Check Wallet</div>
                <div className="text-xs text-muted-foreground">Verify wallet safety</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}