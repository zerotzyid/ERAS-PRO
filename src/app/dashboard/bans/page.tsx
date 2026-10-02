'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Undo2 } from 'lucide-react'
import { BanModal } from '@/components/modals'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Modal,
  Pagination,
  Select,
  Spinner,
  useToast,
} from '@/components/ui'
import { formatDateTime, formatNumber, timeAgo } from '@/lib/format'

type BanItem = {
  _id: string
  uid: string
  userEmail?: string
  userName?: string
  type: 'ban' | 'suspend'
  reason: string
  expiresAt?: string | null
  createdBy: string
  isActive: boolean
  createdAt: string
}

type UserHit = { uid: string; email?: string; name?: string; username?: string; status: string }

export default function BansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <BansContent />
    </Suspense>
  )
}

function BansContent() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const [bans, setBans] = useState<BanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCount, setActiveCount] = useState(0)
  const [filter, setFilter] = useState('true')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  const [showPicker, setShowPicker] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [searching, setSearching] = useState(false)
  const [banTarget, setBanTarget] = useState<UserHit | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchBans = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filter) params.set('active', filter)
      if (type) params.set('type', type)
      const res = await fetch(`/api/admin/bans?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat ban.')
      setBans(data.bans)
      setPages(data.pagination.pages)
      setActiveCount(data.activeCount)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat ban.', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, filter, type, toast])

  useEffect(() => {
    fetchBans()
  }, [fetchBans])

  // Prefill dari ?uid= (mis. setelah memilih user di halaman lain)
  useEffect(() => {
    const uid = searchParams.get('uid')
    if (!uid) return
    fetch(`/api/admin/users/${encodeURIComponent(uid)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          const u = data.user
          setBanTarget({
            uid: u.uid,
            email: u.email,
            name: u.name,
            username: u.username,
            status: u.status,
          })
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const revoke = async (b: BanItem) => {
    if (!confirm(`Cabut ${b.type === 'ban' ? 'blokir' : 'suspend'} untuk ${b.userEmail || b.uid}?`)) {
      return
    }
    setRevoking(b._id)
    try {
      const res = await fetch(`/api/admin/bans/${b._id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal mencabut.')
      toast('Hukuman dicabut, user dipulihkan.')
      fetchBans()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mencabut.', 'error')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ban & Suspend</h1>
          <p className="text-sm text-slate-400">
            {formatNumber(activeCount)} hukuman aktif — berlaku langsung di aplikasi.
          </p>
        </div>
        <Button onClick={() => setShowPicker(true)}>
          <Plus className="h-4 w-4" /> Ban Baru
        </Button>
      </div>

      <Card>
        <div className="flex gap-2 border-b border-slate-800 p-4">
          <Select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="true">Aktif</option>
            <option value="">Semua</option>
            <option value="false">Riwayat (dicabut)</option>
          </Select>
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Blokir + Suspend</option>
            <option value="ban">Blokir saja</option>
            <option value="suspend">Suspend saja</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : bans.length === 0 ? (
          <EmptyState message="Tidak ada data ban." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3">Alasan</th>
                    <th className="px-4 py-3">Berakhir</th>
                    <th className="px-4 py-3">Oleh / Sejak</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bans.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{b.userName || 'Tanpa nama'}</p>
                        <p className="font-mono text-xs text-slate-400">
                          {b.userEmail || b.uid.slice(0, 16) + '…'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Chip color={b.type === 'ban' ? 'red' : 'yellow'}>
                          {b.type === 'ban' ? 'Blokir' : 'Suspend'}
                        </Chip>
                        {!b.isActive && (
                          <div className="mt-1">
                            <Chip color="gray">Dicabut</Chip>
                          </div>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-slate-300" title={b.reason}>
                        {b.reason}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {b.type === 'ban'
                          ? 'Permanen'
                          : b.expiresAt
                            ? formatDateTime(b.expiresAt)
                            : 'Sampai dicabut'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        <p className="truncate">{b.createdBy}</p>
                        <p>{timeAgo(b.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.isActive && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={revoking === b._id}
                            onClick={() => revoke(b)}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Cabut
                          </Button>
                        )}
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

      {showPicker && !banTarget && (
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
                      onClick={() => setBanTarget(h)}
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
                      {h.status !== 'active' && (
                        <Chip color={h.status === 'banned' ? 'red' : 'yellow'}>
                          {h.status === 'banned' ? 'Diblokir' : 'Suspend'}
                        </Chip>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {banTarget && (
        <BanModal
          uid={banTarget.uid}
          userLabel={banTarget.name || banTarget.username || banTarget.email || banTarget.uid}
          onClose={() => {
            setBanTarget(null)
            setShowPicker(false)
          }}
          onDone={(ok, message) => {
            setBanTarget(null)
            setShowPicker(false)
            if (message) toast(message)
            fetchBans()
          }}
        />
      )}
    </div>
  )
}
