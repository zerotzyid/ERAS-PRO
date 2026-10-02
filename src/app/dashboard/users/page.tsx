'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, Search, ShieldAlert, Star, Tag } from 'lucide-react'
import {
  BadgeModal,
  BanModal,
  PremiumModal,
} from '@/components/modals'
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
  StatusChip,
  useToast,
} from '@/components/ui'
import { argbToHex } from '@/lib/badge-color'
import { formatDate, formatDateTime, formatNumber, timeAgo } from '@/lib/format'

type AppUser = {
  _id: string
  uid: string
  email?: string
  name?: string
  username?: string
  photo?: string
  isPremium?: boolean
  premiumExpiresAt?: string | null
  status: string
  banReason?: string
  bannedAt?: string | null
  badgeText?: string
  badgeColor?: unknown
  commentCount?: number
  level?: number
  rank?: string
  totalAnime?: number
  totalEp?: number
  updatedAt?: number
  joinedAt?: string | null
  bookmarkCount?: number
  historyCount?: number
}

type ModalKind = 'detail' | 'ban' | 'premium' | 'badge' | null

export default function UsersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [premium, setPremium] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState<AppUser | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      if (premium) params.set('premium', premium)
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat pengguna.')
      setUsers(data.users)
      setPages(data.pagination.pages)
      setTotal(data.pagination.total)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat pengguna.', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, status, premium, toast])

  useEffect(() => {
    const t = setTimeout(fetchUsers, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [fetchUsers, search])

  const openDetail = async (u: AppUser) => {
    setActive(u)
    setModal('detail')
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(u.uid)}`)
      const data = await res.json()
      if (res.ok && data.user) setActive(data.user)
    } catch {
      // tetap tampilkan data ringkas
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDone = (_ok: boolean, message?: string) => {
    setModal(null)
    if (message) toast(message)
    fetchUsers()
    if (active) openDetail(active)
  }

  const userLabel = (u: AppUser) => u.name || u.username || u.email || u.uid.slice(0, 8)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Pengguna</h1>
        <p className="text-sm text-slate-400">
          Kelola user aplikasi Rinova — {formatNumber(total)} akun terdaftar.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Cari email / nama / username / UID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="suspended">Suspend</option>
              <option value="banned">Diblokir</option>
            </Select>
            <Select
              value={premium}
              onChange={(e) => {
                setPremium(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Semua tipe</option>
              <option value="true">Premium</option>
              <option value="false">Gratis</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState message="Tidak ada pengguna yang cocok." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Premium</th>
                    <th className="px-4 py-3">Badge</th>
                    <th className="px-4 py-3">Bergabung</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                            {userLabel(u).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{userLabel(u)}</p>
                            <p className="truncate text-xs text-slate-400">
                              {u.email || u.uid.slice(0, 12) + '…'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={u.status} />
                      </td>
                      <td className="px-4 py-3">
                        {u.isPremium ? (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            <span className="text-xs">
                              {u.premiumExpiresAt
                                ? formatDate(u.premiumExpiresAt)
                                : 'Lifetime'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Gratis</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.badgeText ? (
                          <span
                            className="rounded-full border px-2.5 py-0.5 text-xs font-bold"
                            style={{
                              borderColor: argbToHex(u.badgeColor),
                              color: argbToHex(u.badgeColor),
                            }}
                          >
                            {u.badgeText}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {timeAgo(u.joinedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            title="Detail"
                            onClick={() => openDetail(u)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            title="Premium"
                            onClick={() => {
                              setActive(u)
                              setModal('premium')
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-amber-300"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                          <button
                            title="Badge"
                            onClick={() => {
                              setActive(u)
                              setModal('badge')
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-violet-300"
                          >
                            <Tag className="h-4 w-4" />
                          </button>
                          <button
                            title="Ban / Suspend"
                            onClick={() => {
                              setActive(u)
                              setModal('ban')
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </button>
                        </div>
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

      {modal === 'detail' && active && (
        <Modal title="Detail Pengguna" onClose={() => setModal(null)} wide>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600/20 text-xl font-bold text-violet-300">
                  {userLabel(active).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{userLabel(active)}</p>
                  <p className="truncate text-sm text-slate-400">{active.email || '—'}</p>
                  <p className="truncate font-mono text-xs text-slate-500">{active.uid}</p>
                </div>
                <div className="flex gap-1.5">
                  <StatusChip status={active.status} />
                  {active.isPremium && <Chip color="yellow">Premium</Chip>}
                </div>
              </div>

              {active.status !== 'active' && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-950/50 px-4 py-3 text-sm">
                  <p className="font-medium text-rose-200">
                    {active.status === 'banned' ? 'Diblokir permanen' : 'Di-suspend'}
                    {active.bannedAt && ` sejak ${formatDateTime(active.bannedAt)}`}
                  </p>
                  {active.banReason && (
                    <p className="mt-1 text-rose-200/80">Alasan: {active.banReason}</p>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Username" value={active.username || '—'} />
                <InfoRow label="Nama" value={active.name || '—'} />
                <InfoRow label="Level" value={active.level ? `Lv. ${active.level}` : '—'} />
                <InfoRow label="Rank" value={active.rank || '—'} />
                <InfoRow label="Komentar" value={formatNumber(Number(active.commentCount) || 0)} />
                <InfoRow label="Bookmark" value={formatNumber(active.bookmarkCount ?? 0)} />
                <InfoRow label="Riwayat nonton" value={formatNumber(active.historyCount ?? 0)} />
                <InfoRow
                  label="Anime / Episode"
                  value={`${formatNumber(active.totalAnime ?? 0)} / ${formatNumber(active.totalEp ?? 0)}`}
                />
                <InfoRow label="Bergabung" value={formatDateTime(active.joinedAt)} />
                <InfoRow
                  label="Terakhir sinkron"
                  value={active.updatedAt ? formatDateTime(Number(active.updatedAt)) : '—'}
                />
                <InfoRow
                  label="Premium s/d"
                  value={
                    active.isPremium
                      ? active.premiumExpiresAt
                        ? formatDateTime(active.premiumExpiresAt)
                        : 'Lifetime'
                      : '—'
                  }
                />
                <InfoRow
                  label="Badge"
                  value={
                    active.badgeText ? (
                      <span
                        className="rounded-full border px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          borderColor: argbToHex(active.badgeColor),
                          color: argbToHex(active.badgeColor),
                        }}
                      >
                        {active.badgeText}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <Button size="sm" variant="secondary" onClick={() => setModal('premium')}>
                  <Star className="h-4 w-4" /> Premium
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setModal('badge')}>
                  <Tag className="h-4 w-4" /> Badge
                </Button>
                <Button size="sm" variant="danger" onClick={() => setModal('ban')}>
                  <ShieldAlert className="h-4 w-4" /> Ban / Suspend
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {modal === 'ban' && active && (
        <BanModal
          uid={active.uid}
          userLabel={userLabel(active)}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
      {modal === 'premium' && active && (
        <PremiumModal
          uid={active.uid}
          userLabel={userLabel(active)}
          currentPremium={{
            isPremium: active.isPremium,
            premiumExpiresAt: active.premiumExpiresAt ?? null,
          }}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
      {modal === 'badge' && active && (
        <BadgeModal
          uid={active.uid}
          userLabel={userLabel(active)}
          currentBadge={active.badgeText}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-800/60 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  )
}
