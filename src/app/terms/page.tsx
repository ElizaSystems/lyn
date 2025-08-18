'use client'
import { Shield, FileText, AlertTriangle, Info } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Terms of Service</h1>
              <p className="text-sm text-muted-foreground">Last updated: August 18, 2025</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8 text-sm sm:text-base">
          {/* Introduction */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to LYN AI Security Platform ("LYN AI", "we", "our", or "us"). These Terms of Service 
              ("Terms") govern your use of our crypto security and defense platform, including all related 
              services, features, content, and applications (collectively, the "Service"). By accessing or 
              using our Service, you agree to be bound by these Terms.
            </p>
          </section>

          {/* Alpha Version Disclaimer */}
          <section className="glass-card p-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-semibold mb-4 text-yellow-500">2. Alpha Version Notice</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    The Service is currently in ALPHA testing phase. This means:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>The Service may contain bugs, errors, or security vulnerabilities</li>
                    <li>Features may be incomplete, non-functional, or subject to change</li>
                    <li>Data loss, service interruptions, or unexpected behavior may occur</li>
                    <li>Security scans and threat detection may not be fully accurate</li>
                    <li>The Service should not be relied upon as your sole security solution</li>
                  </ul>
                  <p className="font-semibold mt-4">
                    USE OF THE ALPHA VERSION IS AT YOUR OWN RISK.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Service Description */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">3. Service Description</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>
                LYN AI provides AI-powered crypto security and defense services, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Real-time threat detection and monitoring</li>
                <li>Phishing and scam detection</li>
                <li>Smart contract security analysis</li>
                <li>Wallet security monitoring</li>
                <li>Security alerts and notifications</li>
                <li>Educational security resources</li>
              </ul>
              <p className="mt-4">
                These services are informational only and do not guarantee complete protection against all threats.
              </p>
            </div>
          </section>

          {/* User Responsibilities */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">4. User Responsibilities</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>By using our Service, you agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintain the security of your own crypto assets and private keys</li>
                <li>Conduct your own research (DYOR) before making any decisions</li>
                <li>Not rely solely on our Service for security protection</li>
                <li>Verify all security alerts and warnings independently</li>
                <li>Report any bugs or vulnerabilities you discover</li>
                <li>Use the Service in compliance with all applicable laws</li>
                <li>Not attempt to exploit, hack, or misuse the Service</li>
              </ul>
            </div>
          </section>

          {/* No Financial Advice */}
          <section className="glass-card p-6 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-semibold mb-4 text-primary">5. No Financial Advice</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p className="font-semibold">
                    IMPORTANT: Nothing provided through our Service constitutes financial, investment, legal, 
                    or tax advice.
                  </p>
                  <p>
                    All information, content, and services provided are for informational and educational 
                    purposes only. We do not recommend or endorse any specific cryptocurrencies, tokens, 
                    NFTs, or investment strategies.
                  </p>
                  <p>
                    You should consult with qualified professionals before making any financial decisions. 
                    Past performance and security analysis do not guarantee future results or protection.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">6. Limitation of Liability</h2>
            <div className="space-y-3 text-muted-foreground">
              <p className="font-semibold uppercase">
                To the maximum extent permitted by law:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  LYN AI AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, AND LICENSORS WILL NOT 
                  BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
                </li>
                <li>
                  WE ARE NOT LIABLE FOR ANY LOSS OF CRYPTO ASSETS, DATA, PROFITS, OR OTHER INTANGIBLE LOSSES
                </li>
                <li>
                  WE ARE NOT RESPONSIBLE FOR SECURITY BREACHES, HACKS, OR THEFT OF YOUR CRYPTO ASSETS
                </li>
                <li>
                  OUR TOTAL LIABILITY SHALL NOT EXCEED $100 USD OR THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS
                </li>
              </ul>
            </div>
          </section>

          {/* Indemnification */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">7. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify, defend, and hold harmless LYN AI and its affiliates from any claims, 
              damages, losses, liabilities, costs, and expenses (including legal fees) arising from your use 
              of the Service, violation of these Terms, violation of any rights of others, or any illegal 
              activities conducted through your account.
            </p>
          </section>

          {/* Privacy */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">8. Privacy</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>
                Your use of our Service is also governed by our Privacy Policy. Key points include:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We do not store private keys or seed phrases</li>
                <li>We collect minimal personal information</li>
                <li>We use encryption for data transmission</li>
                <li>We do not sell your data to third parties</li>
                <li>You can request deletion of your data at any time</li>
              </ul>
            </div>
          </section>

          {/* Intellectual Property */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">9. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, features, and functionality of the Service, including but not limited to text, 
              graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software, 
              are the exclusive property of LYN AI or its licensors and are protected by international 
              copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          {/* Modifications */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">10. Modifications to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of any material 
              changes by posting the new Terms on this page and updating the "Last updated" date. Your 
              continued use of the Service after any changes constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Termination */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your access to the Service immediately, without prior notice or 
              liability, for any reason, including if you breach these Terms. Upon termination, your right 
              to use the Service will immediately cease.
            </p>
          </section>

          {/* Governing Law */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-xl font-semibold mb-4">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
              in which LYN AI operates, without regard to its conflict of law provisions. Any disputes arising 
              from these Terms shall be resolved through binding arbitration.
            </p>
          </section>

          {/* Contact Information */}
          <section className="glass-card p-6 rounded-xl border border-border/50">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-semibold mb-4">13. Contact Information</h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>For questions about these Terms, please contact us at:</p>
                  <ul className="space-y-1 ml-4">
                    <li>Email: legal@lyn-ai.security</li>
                    <li>Website: https://lyn-ai.security</li>
                    <li>Discord: discord.gg/lynai</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Acceptance */}
          <section className="glass-card p-6 rounded-xl border border-primary/30 bg-primary/5">
            <h2 className="text-xl font-semibold mb-4">Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By using LYN AI Security Platform, you acknowledge that you have read, understood, and agree 
              to be bound by these Terms of Service. If you do not agree to these Terms, you must not use 
              our Service.
            </p>
            <p className="mt-4 font-semibold text-primary">
              Remember: Always Do Your Own Research (DYOR) and this is Not Financial Advice (NFA).
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>© 2025 LYN AI Security Platform. All rights reserved.</p>
          <p className="mt-2">Version 1.0.0-alpha</p>
        </div>
      </div>
    </div>
  )
}