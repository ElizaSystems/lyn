'use client'
import { Shield, Lock, FileSearch, AlertTriangle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AuditPage() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold">Security Audit</h1>
            <span className="badge-cyan">Coming Soon</span>
          </div>
          <p className="text-muted-foreground">
            Advanced smart contract auditing and security analysis features
          </p>
        </div>

        <div className="glass-card p-6 rounded-xl border border-border/50 space-y-4">
          <div className="flex items-center gap-3">
            <FileSearch className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="font-medium">Smart Contract Auditing</p>
              <p className="text-sm text-muted-foreground">AI-powered vulnerability detection</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div className="text-left">
              <p className="font-medium">Risk Assessment</p>
              <p className="text-sm text-muted-foreground">Comprehensive threat analysis reports</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div className="text-left">
              <p className="font-medium">Security Certification</p>
              <p className="text-sm text-muted-foreground">Verified security badges for projects</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>Feature locked • Requires LYN token holding</span>
        </div>

        <Button className="bg-primary hover:bg-primary/90">
          Get Notified
        </Button>
      </div>
    </div>
  )
}