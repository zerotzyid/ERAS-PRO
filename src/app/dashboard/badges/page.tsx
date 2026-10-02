'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui'
import { formatNumber } from '@/lib/format'

type BadgeItem = {
  _id: string
  name: string
  description?: string
  color: string
  type: string
  isActive: boolean
  assignedCount: number
}

type UserHit = { uid: string; email?: string; name?: string; username?: string }

const TYPE_LABELS: Record<string, string> = {
  role: 'Role',
  achievement: 'Pencapaian',
  special: 'Spesial',
  verification: 'Verifikasi',
}

const EMPTY_FORM = { name: '', description: '', color: '#8B5CF6', type: 'role' }

export default function BadgesPage() {
  const toast = useToast()
  const [badges, setBadges] = useState<BadgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BadgeItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [assignBadge, setAssignBadge] = useState<BadgeItem | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [searching, setSearching] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  const fetchBadges = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/badges')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat badge.')
      setBadges(data.badges)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat badge.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchBadges()
  }, [fetchBadges])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (b: BadgeItem) => {
    setEditing(b)
    setForm({ name: b.name, description: b.description || '', color: b.color, type: b.type })
    setShowForm(true)
  }

  const saveForm = async () => {
    if (!editing && !form.name.trim()) {
      toast('Nama badge wajib diisi.', 'error')
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/badges/${editing._id}` : '/api/admin/badges'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editing
            ? { description: form.description, color: form.color, type: form.type }
            : form,
        ),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan badge.')
      toast(editing ? 'Badge diperbarui.' : 'Badge dibuat.')
      setShowForm(false)
      fetchBadges()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan badge.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (b: BadgeItem) => {
    try {
      const res = await fetch(`/api/admin/badges/${b._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal mengubah status.')
      toast(b.isActive ? 'Badge dinonaktifkan.' : 'Badge diaktifkan.')
      fetchBadges()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengubah status.', 'error')
    }
  }

  const removeBadge = async (b: BadgeItem) => {
    if (
      !confirm(
        `Hapus badge "${b.name}"? Badge akan dilepas dari ${b.assignedCount} pengguna yang memakainya.`,
      )
    ) {
      return
    }
    try {
      const res = await fetch(`/api/admin/badges/${b._id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus.')
      toast('Badge dihapus.')
      fetchBadges()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus.', 'error')
    }
  }

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

  const assignTo = async (uid: string) => {
    if (!assignBadge) return
    setAssigning(uid)
    try {
      const res = await fetch('/api/admin/badges/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, name: assignBadge.name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal memasang badge.')
      toast(`Badge "${assignBadge.name}" dipasang.`)
      setAssignBadge(null)
      fetchBadges()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memasang badge.', 'error')
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Badge</h1>
          <p className="text-sm text-slate-400">
            Kelola tag badge — badge yang dipasang tampil di profil & komentar aplikasi.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Badge Baru
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : badges.length === 0 ? (
        <Card>
          <EmptyState message="Belum ada badge. Buat badge pertama." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => (
            <Card key={b._id} className={`p-5 ${b.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <span
                  className="rounded-full border px-3 py-1 text-sm font-bold"
                  style={{ borderColor: b.color, color: b.color, backgroundColor: `${b.color}14` }}
                >
                  {b.name}
                </span>
                <Chip color={b.isActive ? 'green' : 'gray'}>
                  {b.isActive ? 'Aktif' : 'Nonaktif'}
                </Chip>
              </div>
              <p className="mt-2 text-sm text-slate-400">{b.description || '—'}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span>{TYPE_LABELS[b.type] || b.type}</span>
                <span>·</span>
                <span>{formatNumber(b.assignedCount)} pengguna</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                <Button size="sm" variant="secondary" onClick={() => setAssignBadge(b)}>
                  <UserPlus className="h-3.5 w-3.5" /> Pasang
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openEdit(b)}>
                  <Pencil className="h-3.5 w-3.5" /> Ubah
                </Button>
                <Button size="sm" variant="secondary" onClick={() => toggleActive(b)}>
                  {b.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => removeBadge(b)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? `Ubah Badge — ${editing.name}` : 'Badge Baru'}
          onClose={() => setShowForm(false)}
        >
          <div className="space-y-4">
            <div>
              <Label>Nama badge</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                placeholder="cth. VIP"
                disabled={!!editing}
                maxLength={20}
              />
              {editing && (
                <p className="mt-1 text-xs text-slate-500">
                  Nama tidak bisa diubah karena dipakai sebagai penanda di aplikasi.
                </p>
              )}
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="cth. Member premium setia…"
              />
            </div>
            <div>
              <Label>Warna</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })}
                  className="h-10 w-14 cursor-pointer rounded border border-slate-700 bg-slate-800"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-32"
                />
                <span
                  className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={{
                    borderColor: form.color,
                    color: form.color,
                    backgroundColor: `${form.color}14`,
                  }}
                >
                  {form.name || 'PREVIEW'}
                </span>
              </div>
            </div>
            <div>
              <Label>Tipe</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="role">Role</option>
                <option value="achievement">Pencapaian</option>
                <option value="special">Spesial</option>
                <option value="verification">Verifikasi</option>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
                Batal
              </Button>
              <Button onClick={saveForm} disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {assignBadge && (
        <Modal title={`Pasang "${assignBadge.name}"`} onClose={() => setAssignBadge(null)}>
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
                  <li
                    key={h.uid}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {h.name || h.username || 'Tanpa nama'}
                      </p>
                      <p className="truncate font-mono text-xs text-slate-400">
                        {h.email || h.uid}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={assigning === h.uid}
                      onClick={() => assignTo(h.uid)}
                    >
                      {assigning === h.uid ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Pasang'
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
