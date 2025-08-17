'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Terminal, 
  Wallet, 
  Zap, 
  TrendingUp, 
  BarChart3, 
  DollarSign, 
  Coins,
  Shield,
  Menu,
  X,
  Settings,
  MessageCircle,
  Github
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

  const agentItems: SidebarItem[] = [
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
      label: 'Trading', 
      path: '/trading', 
      icon: <TrendingUp className="w-5 h-5" />,
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

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 h-screen bg-sidebar border-r border-border flex flex-col`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
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
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-sidebar-accent rounded-md transition-colors"
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
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
  )
}