'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Ban,
  Bell,
  ChevronDown,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  PlayCircle,
  Settings,
  Star,
  Tag,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Beranda', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/users', label: 'Pengguna', icon: Users },
  { href: '/dashboard/bans', label: 'Ban & Suspend', icon: Ban },
  { href: '/dashboard/premium', label: 'Premium', icon: Star },
  { href: '/dashboard/badges', label: 'Badge', icon: Tag },
  { href: '/dashboard/announcements', label: 'Pengumuman', icon: Bell },
  { href: '/dashboard/updates', label: 'Update App', icon: Download },
  { href: '/dashboard/settings', label: 'Pengaturan', icon: Settings },
]

type Me = { email: string; name: string; role: string }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setMe(data.user)
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/auth/signin')
    router.refresh()
  }

  const initials = (me?.name || me?.email || 'A').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:translate-x-0',
          sidebarOpen && 'translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-rose-600">
              <PlayCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Rinova</p>
              <p className="text-[11px] leading-tight text-slate-400">Web Control</p>
            </div>
          </div>
          <button
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-violet-600/20 text-violet-200'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-800"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium">{me?.name || 'Memuat…'}</p>
              <p className="truncate text-xs text-slate-400">{me?.email || ''}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
          {menuOpen && (
            <button
              onClick={handleLogout}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-rose-300 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          )}
        </div>
      </aside>

      {/* Konten */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-auto hidden items-center gap-2 sm:flex">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                {me?.role === 'moderator' ? 'Moderator' : 'Admin'}
              </span>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
