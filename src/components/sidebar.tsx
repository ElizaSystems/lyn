'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Terminal, 
  Wallet, 
  Zap, 
  BarChart3, 
  DollarSign, 
  Coins,
  Shield,
  Menu,
  X,
  Settings,
  MessageCircle,
  Github,
  FileText,
  Map,
  FileSearch,
  Scan,
  Sparkles,
  Gift
} from 'lucide-react'

interface SidebarItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: string
  badgeType?: 'pink' | 'cyan'
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const agentItems: SidebarItem[] = [
    { 
      label: 'Chat', 
      path: '/security', 
      icon: <MessageCircle className="w-5 h-5" />
    },
        { 
      label: 'SecScan', 
      path: '/scans', 
      icon: <Scan className="w-5 h-5" />,
      badge: 'Live',
      badgeType: 'pink'
    },
    { 
      label: 'Wallet Security', 
      path: '/wallet-security', 
      icon: <Shield className="w-5 h-5" />,
      badge: 'New',
      badgeType: 'cyan'
    },
    { 
      label: 'Terminal', 
      path: '/terminal', 
      icon: <Terminal className="w-5 h-5" />
    },
    { 
      label: 'Agent Wallet', 
      path: '/wallet', 
      icon: <Wallet className="w-5 h-5" />
    },
    { 
      label: 'Automated Tasks', 
      path: '/tasks', 
      icon: <Zap className="w-5 h-5" />
    },
    { 
      label: 'Security Audit', 
      path: '/audit', 
      icon: <FileSearch className="w-5 h-5" />,
      badge: 'Soon',
      badgeType: 'cyan'
    },
    { 
      label: 'Analytics', 
      path: '/analytics', 
      icon: <BarChart3 className="w-5 h-5" />
    },
  ]

  const tokenItems: SidebarItem[] = [
    { 
      label: 'Burn Tracker', 
      path: '/burn', 
      icon: <DollarSign className="w-5 h-5" />,
      badge: 'New',
      badgeType: 'pink'
    },
    {
      label: 'Referral Program',
      path: '/referral',
      icon: <Gift className="w-5 h-5" />,
      badge: 'Earn 20%',
      badgeType: 'pink'
    },
    { 
      label: 'Metrics', 
      path: '/metrics', 
      icon: <BarChart3 className="w-5 h-5" />
    },
    { 
      label: 'Buy $LYN', 
      path: '/buy', 
      icon: <Coins className="w-5 h-5" />
    },
    { 
      label: 'Staking', 
      path: '/staking', 
      icon: <Shield className="w-5 h-5" />
    },
  ]

  const aboutItems: SidebarItem[] = [
    {
      label: 'Manifesto',
      path: '/manifesto',
      icon: <Sparkles className="w-5 h-5" />,
      badge: 'Cosmic',
      badgeType: 'pink'
    },
    { 
      label: 'Litepaper', 
      path: '/litepaper', 
      icon: <FileText className="w-5 h-5" />
    },
    { 
      label: 'Roadmap', 
      path: '/roadmap', 
      icon: <Map className="w-5 h-5" />
    },
  ]

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      
      {/* Mobile menu button - improved for better touch target */}
      <button
        className="fixed top-3 left-3 z-50 lg:hidden p-3 min-w-[44px] min-h-[44px] bg-sidebar border border-border rounded-lg shadow-lg active:scale-95 transition-transform"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      <aside className={`
        ${collapsed ? 'w-16' : 'w-64'} 
        transition-all duration-300 h-screen bg-sidebar border-r border-border flex flex-col
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 fixed lg:relative z-50
      `}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo.png" 
              alt="LYN AI" 
              className="w-8 h-8 rounded-lg object-cover"
            />
            {!collapsed && (
              <span className="text-lg font-bold text-foreground">LYN AI</span>
            )}
          </Link>
          
          {/* Desktop collapse button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-sidebar-accent rounded-md transition-colors hidden lg:block"
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
          
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 hover:bg-sidebar-accent rounded-md transition-colors lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>


      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-6">
          {!collapsed && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              MY AGENT
            </h3>
          )}
          <nav className="space-y-1">
            {agentItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={item.badgeType === 'pink' ? 'badge-pink' : 'badge-cyan'}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="px-4 mb-6">
          {!collapsed && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              LYN TOKEN
            </h3>
          )}
          <nav className="space-y-1">
            {tokenItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={item.badgeType === 'pink' ? 'badge-pink' : 'badge-cyan'}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="px-4 mb-6">
          {!collapsed && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              ABOUT
            </h3>
          )}
          <nav className="space-y-1">
            {aboutItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={item.badgeType === 'pink' ? 'badge-pink' : 'badge-cyan'}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="border-t border-border p-4">
        {!collapsed && (
          <p className="text-xs text-muted-foreground mb-3">Need help? Join our community</p>
        )}
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-sidebar-accent rounded-md transition-colors">
            <MessageCircle className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
          <button className="p-2 hover:bg-sidebar-accent rounded-md transition-colors">
            <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
          <button className="p-2 hover:bg-sidebar-accent rounded-md transition-colors">
            <Github className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        {!collapsed && (
          <p className="text-xs text-muted-foreground mt-3">
            2025 © LYN AI. v1.1.1.0xc4f88
          </p>
        )}
      </div>
    </aside>
    </>
  )
}