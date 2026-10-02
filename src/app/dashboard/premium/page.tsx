'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { PremiumModal } from '@/components/modals'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Modal,
  Pagination,
  Spinner,
  useToast,
} from '@/components/ui'
import { formatDateTime, formatNumber, timeAgo } from '@/lib/format'

type ActiveUser = {
  _id: string
  uid: string
  email?: string
  name?: string
  username?: string
  premiumExpiresAt?: string | null
  lastPlan?: string
  lastBy?: string
}

type Grant = {
  _id: string
  uid: string
  userEmail?: string
  userName?: string
  action: 'grant' | 'revoke'
  plan?: string
  expiresAt?: string | null
  note?: string
  createdBy: string
  createdAt: string
}

type UserHit = {
  uid: string
  email?: string
  name?: string
  username?: string
  isPremium?: boolean
  premiumExpiresAt?: string | null
}

export default function PremiumPage() {
  const toast = useToast()
  const [tab, setTab] = useState<'aktif' | 'riwayat'>('aktif')
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [showPicker, setShowPicker] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [searching, setSearching] = useState(false)
  const [grantTarget, setGrantTarget] = useState<UserHit | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab, page: String(page), limit: '20' })
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/admin/premium?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat premium.')
      if (tab === 'aktif') setActiveUsers(data.users)
      else setGrants(data.grants)
      setPages(data.pagination.pages)
      setTotal(data.pagination.total)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat premium.', 'error')
    } finally {
      setLoading(false)
    }
  }, [tab, page, search, toast])

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [fetchData, search])

  const searchUsers = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(query.trim())}&limit=8`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pencarian gagal.')
      setHits(data.users)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Pencarian gagal.', 'error')
    } finally {
      setSearching(false)
    }
  }

  const revoke = async (u: ActiveUser) => {
    if (!confirm(`Cabut premium ${u.email || u.uid}?`)) return
    setRevoking(u.uid)
    try {
      const res = await fetch('/api/admin/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', uid: u.uid }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal mencabut.')
      toast('Premium dicabut.')
      fetchData()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mencabut.', 'error')
    } finally {
      setRevoking(null)
    }
  }

  const expiryLabel = (iso?: string | null) => {
    if (!iso) return <Chip color="yellow">Lifetime</Chip>
    const diff = new Date(iso).getTime() - Date.now()
    if (diff <= 0) return <Chip color="red">Kedaluwarsa</Chip>
    const days = Math.ceil(diff / 86400000)
    if (days <= 7) return <Chip color="yellow">Sisa {days} hari</Chip>
    return <Chip color="green">{formatDateTime(iso)}</Chip>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Premium</h1>
          <p className="text-sm text-slate-400">
            Kelola langganan premium — {formatNumber(total)}{' '}
            {tab === 'aktif' ? 'premium aktif' : 'riwayat'}.
          </p>
        </div>
        <Button onClick={() => setShowPicker(true)}>
          <Plus className="h-4 w-4" /> Beri Premium
        </Button>
      </div>

      <div className="flex gap-2">
        {(['aktif', 'riwayat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              setPage(1)
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t === 'aktif' ? 'Premium Aktif' : 'Riwayat'}
          </button>
        ))}
      </div>

      <Card>
        <div className="border-b border-slate-800 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder={tab === 'aktif' ? 'Cari pengguna…' : 'Cari riwayat…'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : tab === 'aktif' ? (
          activeUsers.length === 0 ? (
            <EmptyState message="Tidak ada premium aktif." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Pengguna</th>
                      <th className="px-4 py-3">Paket</th>
                      <th className="px-4 py-3">Kedaluwarsa</th>
                      <th className="px-4 py-3">Diberi oleh</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {activeUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <p className="font-medium">{u.name || u.username || 'Tanpa nama'}</p>
                          <p className="font-mono text-xs text-slate-400">{u.email || u.uid}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Chip color="yellow">{u.lastPlan || '—'}</Chip>
                        </td>
                        <td className="px-4 py-3">{expiryLabel(u.premiumExpiresAt)}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-400">
                          {u.lastBy || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setGrantTarget({
                                  uid: u.uid,
                                  email: u.email,
                                  name: u.name,
                                  username: u.username,
                                  isPremium: true,
                                  premiumExpiresAt: u.premiumExpiresAt ?? null,
                                })
                              }
                            >
                              Perpanjang
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={revoking === u.uid}
                              onClick={() => revoke(u)}
                            >
                              {revoking === u.uid ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                'Cabut'
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} onChange={setPage} />
            </>
          )
        ) : grants.length === 0 ? (
          <EmptyState message="Belum ada riwayat." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Aksi</th>
                    <th className="px-4 py-3">Paket</th>
                    <th className="px-4 py-3">Catatan</th>
                    <th className="px-4 py-3">Oleh / Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {grants.map((g) => (
                    <tr key={g._id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{g.userName || 'Tanpa nama'}</p>
                        <p className="font-mono text-xs text-slate-400">{g.userEmail || g.uid}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Chip color={g.action === 'grant' ? 'green' : 'red'}>
                          {g.action === 'grant' ? 'Diberi' : 'Dicabut'}
                        </Chip>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{g.plan || '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-400" title={g.note}>
                        {g.note || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        <p className="truncate">{g.createdBy}</p>
                        <p>{timeAgo(g.createdAt)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onChange={setPage} />
          </>
        )}
      </Card>

      {showPicker && !grantTarget && (
        <Modal title="Pilih Pengguna" onClose={() => setShowPicker(false)}>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Cari email / nama / UID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  className="pl-9"
                />
              </div>
              <Button onClick={searchUsers} disabled={searching}>
                {searching ? <Spinner className="h-4 w-4" /> : 'Cari'}
              </Button>
            </div>
            {hits.length > 0 && (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {hits.map((h) => (
                  <li key={h.uid}>
                    <button
                      onClick={() => setGrantTarget(h)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {h.name || h.username || 'Tanpa nama'}
                        </p>
                        <p className="truncate font-mono text-xs text-slate-400">
                          {h.email || h.uid}
                        </p>
                      </div>
                      {h.isPremium && <Chip color="yellow">Premium</Chip>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {grantTarget && (
        <PremiumModal
          uid={grantTarget.uid}
          userLabel={
            grantTarget.name || grantTarget.username || grantTarget.email || grantTarget.uid
          }
          currentPremium={{
            isPremium: grantTarget.isPremium,
            premiumExpiresAt: grantTarget.premiumExpiresAt ?? null,
          }}
          onClose={() => {
            setGrantTarget(null)
            setShowPicker(false)
          }}
          onDone={(_ok, message) => {
            setGrantTarget(null)
            setShowPicker(false)
            if (message) toast(message)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
