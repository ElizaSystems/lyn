'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X, Shield } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { WalletButton } from '@/components/solana/solana-provider'

export function AppHeader({ links = [] }: { links: { label: string; path: string }[] }) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <header className="relative z-50 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-primary/20 dark:border-primary/30">
      <div className="mx-auto flex justify-between items-center">
        <div className="flex items-baseline gap-4">
          <Link className="flex items-center gap-2 text-xl hover:text-primary transition-colors" href="/">
            <Shield className="h-6 w-6 text-secondary drop-shadow-[0_0_15px_rgba(0,100,255,0.5)]" />
            <span className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent neon-glow-pink">LYN Security</span>
          </Link>
          <div className="hidden md:flex items-center">
            <ul className="flex gap-4 flex-nowrap items-center">
              {links.map(({ label, path }) => (
                <li key={path}>
                  <Link
                    className={`hover:text-primary transition-colors ${isActive(path) ? 'text-primary neon-glow-pink' : 'text-foreground/70'}`}
                    href={path}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Button variant="ghost" size="icon" className="md:hidden hover:bg-primary/10 transition-colors" onClick={() => setShowMenu(!showMenu)}>
          {showMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>

        <div className="hidden md:flex items-center gap-4">
          <WalletButton size="sm" />
          <ThemeSelect />
        </div>

        {showMenu && (
          <div className="md:hidden fixed inset-x-0 top-[52px] bottom-0 bg-background/95 backdrop-blur-md">
            <div className="flex flex-col p-4 gap-4 border-t border-primary/20">
              <ul className="flex flex-col gap-4">
                {links.map(({ label, path }) => (
                  <li key={path}>
                    <Link
                      className={`hover:text-primary transition-colors block text-lg py-2 ${isActive(path) ? 'text-primary neon-glow-pink' : 'text-foreground/70'}`}
                      href={path}
                      onClick={() => setShowMenu(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-4">
                <WalletButton />
                <ThemeSelect />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
