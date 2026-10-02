'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, Loader2, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  Modal,
  Pagination,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui'
import { formatDateTime, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

type Announcement = {
  _id: string
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  targetAudience: 'all' | 'free' | 'premium'
  isPublished: boolean
  publishedAt?: string | null
  expiresAt?: string | null
  createdBy: string
  createdAt: string
}

const TYPE_META = {
  info: { label: 'Info', icon: Info, cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  success: { label: 'Sukses', icon: CheckCircle2, cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  warning: { label: 'Peringatan', icon: AlertTriangle, cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  error: { label: 'Penting', icon: XCircle, cls: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Semua user',
  free: 'Gratis saja',
  premium: 'Premium saja',
}

const EMPTY_FORM = {
  title: '',
  content: '',
  type: 'info',
  targetAudience: 'all',
  isPublished: true,
  expiresAt: '',
}

export default function AnnouncementsPage() {
  const toast = useToast()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filter) params.set('published', filter)
      const res = await fetch(`/api/admin/announcements?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat pengumuman.')
      setItems(data.announcements)
      setPages(data.pagination.pages)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat pengumuman.', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, filter, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (a: Announcement) => {
    setEditing(a)
    setForm({
      title: a.title,
      content: a.content,
      type: a.type,
      targetAudience: a.targetAudience,
      isPublished: a.isPublished,
      expiresAt: a.expiresAt ? toLocalInput(new Date(a.expiresAt).getTime()) : '',
    })
    setShowForm(true)
  }

  const saveForm = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast('Judul dan isi wajib diisi.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        targetAudience: form.targetAudience,
        isPublished: form.isPublished,
        expiresAt: form.expiresAt || undefined,
      }
      const url = editing ? `/api/admin/announcements/${editing._id}` : '/api/admin/announcements'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan.')
      toast(editing ? 'Pengumuman diperbarui.' : 'Pengumuman dibuat.')
      setShowForm(false)
      fetchData()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/admin/announcements/${a._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !a.isPublished }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal mengubah status.')
      toast(a.isPublished ? 'Pengumuman dihentikan.' : 'Pengumuman ditayangkan.')
      fetchData()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengubah status.', 'error')
    }
  }

  const removeItem = async (a: Announcement) => {
    if (!confirm(`Hapus pengumuman "${a.title}"?`)) return
    try {
      const res = await fetch(`/api/admin/announcements/${a._id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus.')
      toast('Pengumuman dihapus.')
      fetchData()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus.', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pengumuman</h1>
          <p className="text-sm text-slate-400">
            Pengumuman yang tayang tampil di aplikasi Android.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Buat Baru
        </Button>
      </div>

      <div className="flex gap-2">
        <Select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Semua</option>
          <option value="true">Tayang</option>
          <option value="false">Draf / Berhenti</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState message="Belum ada pengumuman." />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((a) => {
              const meta = TYPE_META[a.type] || TYPE_META.info
              const expired = a.expiresAt ? new Date(a.expiresAt).getTime() <= Date.now() : false
              return (
                <Card key={a._id} className={cn('p-5', !a.isPublished && 'opacity-75')}>
                  <div className="flex items-start gap-3">
                    <div className={cn('rounded-lg border p-2', meta.cls)}>
                      <meta.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Chip color={a.isPublished && !expired ? 'green' : 'gray'}>
                          {expired ? 'Kedaluwarsa' : a.isPublished ? 'Tayang' : 'Draf'}
                        </Chip>
                        <Chip color="blue">{AUDIENCE_LABELS[a.targetAudience]}</Chip>
                        <Chip color="violet">{meta.label}</Chip>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{a.content}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    {a.publishedAt ? `Tayang ${timeAgo(a.publishedAt)}` : 'Belum pernah tayang'}
                    {a.expiresAt && ` · s/d ${formatDateTime(a.expiresAt)}`}
                    {` · oleh ${a.createdBy}`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                    <Button size="sm" variant="secondary" onClick={() => togglePublish(a)}>
                      {a.isPublished ? 'Hentikan' : 'Tayangkan'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" /> Ubah
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeItem(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}

      {showForm && (
        <Modal title={editing ? 'Ubah Pengumuman' : 'Pengumuman Baru'} onClose={() => setShowForm(false)} wide>
          <div className="space-y-4">
            <div>
              <Label>Judul</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="cth. Maintenance malam ini"
                maxLength={120}
              />
            </div>
            <div>
              <Label>Isi</Label>
              <Textarea
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Tulis isi pengumuman untuk pengguna aplikasi…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipe</Label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="info">Info</option>
                  <option value="success">Sukses</option>
                  <option value="warning">Peringatan</option>
                  <option value="error">Penting</option>
                </Select>
              </div>
              <div>
                <Label>Target</Label>
                <Select
                  value={form.targetAudience}
                  onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                >
                  <option value="all">Semua user</option>
                  <option value="free">Gratis saja</option>
                  <option value="premium">Premium saja</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Kedaluwarsa (opsional)</Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pub"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="h-4 w-4 accent-violet-600"
              />
              <label htmlFor="pub" className="text-sm text-slate-300">
                Langsung tayangkan di aplikasi
              </label>
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

      <Card className="p-4 text-xs text-slate-500">
        <p className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Aplikasi membaca pengumuman dari endpoint publik{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
            /api/public/announcements
          </code>
        </p>
      </Card>
    </div>
  )
}

function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
