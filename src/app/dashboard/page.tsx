'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, Ban, Bell, Star, Tag, Users } from 'lucide-react'
import { Card, Chip, EmptyState, Spinner, StatusChip } from '@/components/ui'
import { formatNumber, timeAgo } from '@/lib/format'

type Stats = {
  total: number
  premium: number
  banned: number
  suspended: number
  active7d: number
  activeBans: number
  published: number
  activeBadges: number
}

type RecentUser = {
  _id: string
  uid: string
  email?: string
  name?: string
  username?: string
  isPremium?: boolean
  status?: string
  updatedAt?: number
  joinedAt?: string | null
}

type RecentBan = {
  _id: string
  uid: string
  userEmail?: string
  type: string
  reason: string
  createdAt: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [recentBans, setRecentBans] = useState<RecentBan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memuat statistik')
        setStats(data.stats)
        setRecentUsers(data.recentUsers ?? [])
        setRecentBans(data.recentBans ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-rose-300">Gagal memuat data</p>
        <p className="mt-1 text-sm text-slate-400">{error}</p>
        <p className="mt-3 text-xs text-slate-500">
          Pastikan MONGODB_URI di .env.local sudah diisi & Network Access Atlas mengizinkan
          koneksi (0.0.0.0/0 untuk Vercel).
        </p>
      </Card>
    )
  }

  const cards = [
    { label: 'Total Pengguna', value: stats?.total ?? 0, icon: Users, href: '/dashboard/users', color: 'text-sky-400 bg-sky-500/10' },
    { label: 'Premium Aktif', value: stats?.premium ?? 0, icon: Star, href: '/dashboard/premium', color: 'text-amber-400 bg-amber-500/10' },
    { label: 'Ban Aktif', value: stats?.activeBans ?? 0, icon: Ban, href: '/dashboard/bans', color: 'text-rose-400 bg-rose-500/10' },
    { label: 'Aktif 7 Hari', value: stats?.active7d ?? 0, icon: Activity, href: '/dashboard/users', color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Suspended', value: stats?.suspended ?? 0, icon: Ban, href: '/dashboard/bans', color: 'text-amber-400 bg-amber-500/10' },
    { label: 'Diblokir', value: stats?.banned ?? 0, icon: Ban, href: '/dashboard/bans', color: 'text-rose-400 bg-rose-500/10' },
    { label: 'Pengumuman Tayang', value: stats?.published ?? 0, icon: Bell, href: '/dashboard/announcements', color: 'text-violet-400 bg-violet-500/10' },
    { label: 'Badge Aktif', value: stats?.activeBadges ?? 0, icon: Tag, href: '/dashboard/badges', color: 'text-sky-400 bg-sky-500/10' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Beranda</h1>
        <p className="text-sm text-slate-400">
          Ringkasan monitoring aplikasi Rinova — data langsung dari database.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="p-5 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-3 ${c.color}`}>
                  <c.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">{c.label}</p>
                  <p className="text-2xl font-bold">{formatNumber(c.value)}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-800 px-5 py-3.5">
            <h2 className="font-semibold">Pengguna Terbaru</h2>
          </div>
          {recentUsers.length === 0 ? (
            <EmptyState message="Belum ada pengguna." />
          ) : (
            <ul className="divide-y divide-slate-800">
              {recentUsers.map((u) => (
                <li key={u._id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                    {(u.name || u.username || u.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.name || u.username || 'Tanpa nama'}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {u.email || u.uid} · {timeAgo(u.joinedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {u.isPremium && <Chip color="yellow">Premium</Chip>}
                    <StatusChip status={u.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="border-b border-slate-800 px-5 py-3.5">
            <h2 className="font-semibold">Ban Terbaru</h2>
          </div>
          {recentBans.length === 0 ? (
            <EmptyState message="Belum ada riwayat ban." />
          ) : (
            <ul className="divide-y divide-slate-800">
              {recentBans.map((b) => (
                <li key={b._id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Chip color={b.type === 'ban' ? 'red' : 'yellow'}>
                      {b.type === 'ban' ? 'Blokir' : 'Suspend'}
                    </Chip>
                    <p className="truncate text-sm font-medium">{b.userEmail || b.uid}</p>
                    <span className="ml-auto shrink-0 text-xs text-slate-500">
                      {timeAgo(b.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{b.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
