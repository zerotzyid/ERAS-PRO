'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  Modal,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui'
import { formatDateTime, timeAgo } from '@/lib/format'

type Release = {
  _id: string
  versionCode: number
  versionName: string
  apkUrl: string
  changelog?: string
  mandatory: boolean
  isPublished: boolean
  publishedAt?: string | null
  createdBy: string
  createdAt: string
}

const EMPTY_FORM = {
  versionCode: '',
  versionName: '',
  apkUrl: '',
  changelog: '',
  mandatory: false,
  isPublished: true,
}

export default function UpdatesPage() {
  const toast = useToast()
  const [releases, setReleases] = useState<Release[]>([])
  const [latest, setLatest] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Release | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/updates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat rilisan.')
      setReleases(data.updates)
      setLatest(data.latestPublished ?? null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat rilisan.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (r: Release) => {
    setEditing(r)
    setForm({
      versionCode: String(r.versionCode),
      versionName: r.versionName,
      apkUrl: r.apkUrl,
      changelog: r.changelog || '',
      mandatory: r.mandatory,
      isPublished: r.isPublished,
    })
    setShowForm(true)
  }

  const saveForm = async () => {
    const vc = Number(form.versionCode)
    if (!editing && (!Number.isInteger(vc) || vc < 1)) {
      toast('Version code harus angka bulat ≥ 1.', 'error')
      return
    }
    if (!form.versionName.trim() || !form.apkUrl.trim()) {
      toast('Nama versi dan link APK wajib diisi.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = editing
        ? {
            versionName: form.versionName.trim(),
            apkUrl: form.apkUrl.trim(),
            changelog: form.changelog.trim(),
            mandatory: form.mandatory,
            isPublished: form.isPublished,
          }
        : {
            versionCode: vc,
            versionName: form.versionName.trim(),
            apkUrl: form.apkUrl.trim(),
            changelog: form.changelog.trim() || undefined,
            mandatory: form.mandatory,
            isPublished: form.isPublished,
          }
      const url = editing ? `/api/admin/updates/${editing._id}` : '/api/admin/updates'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan.')
      toast(editing ? 'Rilisan diperbarui.' : 'Rilisan diterbitkan.')
      setShowForm(false)
      fetchData()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (r: Release) => {
    try {
      const res = await fetch(`/api/admin/updates/${r._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !r.isPublished }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal mengubah status.')
      toast(r.isPublished ? 'Rilisan ditarik.' : 'Rilisan ditayangkan.')
      fetchData()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengubah status.', 'error')
    }
  }

  const removeItem = async (r: Release) => {
    if (!confirm(`Hapus rilisan v${r.versionName} (${r.versionCode})?`)) return
    try {
      const res = await fetch(`/api/admin/updates/${r._id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus.')
      toast('Rilisan dihapus.')
      fetchData()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus.', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Update App</h1>
          <p className="text-sm text-slate-400">
            Terbitkan versi baru — aplikasi mengecek otomatis saat dibuka.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Rilis Baru
        </Button>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Download className="h-4 w-4" /> Versi tayang saat ini
        </h2>
        {latest ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-lg font-bold">
              v{latest.versionName} ({latest.versionCode})
            </span>
            <Chip color={latest.mandatory ? 'red' : 'green'}>
              {latest.mandatory ? 'Wajib update' : 'Opsional'}
            </Chip>
            <span className="text-xs text-slate-500">
              tayang {timeAgo(latest.publishedAt)}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Belum ada rilisan yang tayang. Aplikasi tidak akan menampilkan dialog update.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Aplikasi terpasang saat ini: versionCode <code className="font-mono">1</code> — isi
          version code RILIS BARU lebih besar dari itu agar dialog muncul. Endpoint cek:{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">
            /api/public/app-update?versionCode=1
          </code>
        </p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : releases.length === 0 ? (
        <Card>
          <EmptyState message="Belum ada rilisan. Buat rilisan pertama." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {releases.map((r) => (
            <Card key={r._id} className={`p-5 ${r.isPublished ? '' : 'opacity-75'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">
                    v{r.versionName}{' '}
                    <span className="font-mono text-xs font-normal text-slate-500">
                      ({r.versionCode})
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Chip color={r.isPublished ? 'green' : 'gray'}>
                      {r.isPublished ? 'Tayang' : 'Draf'}
                    </Chip>
                    <Chip color={r.mandatory ? 'red' : 'blue'}>
                      {r.mandatory ? 'Wajib' : 'Opsional'}
                    </Chip>
                  </div>
                </div>
              </div>
              {r.changelog && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{r.changelog}</p>
              )}
              <a
                href={r.apkUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block truncate font-mono text-xs text-sky-400 hover:underline"
              >
                {r.apkUrl}
              </a>
              <p className="mt-1 text-xs text-slate-500">
                {r.publishedAt ? `Tayang ${formatDateTime(r.publishedAt)}` : 'Belum tayang'}
                {` · oleh ${r.createdBy}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                <Button size="sm" variant="secondary" onClick={() => togglePublish(r)}>
                  {r.isPublished ? 'Tarik' : 'Tayangkan'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5" /> Ubah
                </Button>
                <Button size="sm" variant="danger" onClick={() => removeItem(r)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? `Ubah Rilisan v${editing.versionName}` : 'Rilis Baru'}
          onClose={() => setShowForm(false)}
          wide
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Version code *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.versionCode}
                  onChange={(e) => setForm({ ...form, versionCode: e.target.value })}
                  placeholder="cth. 2"
                  disabled={!!editing}
                />
                {!editing && (
                  <p className="mt-1 text-xs text-slate-500">
                    Angka bulat, harus lebih besar dari versi terpasang (saat ini 1).
                  </p>
                )}
              </div>
              <div>
                <Label>Nama versi *</Label>
                <Input
                  value={form.versionName}
                  onChange={(e) => setForm({ ...form, versionName: e.target.value })}
                  placeholder="cth. 1.1"
                  maxLength={20}
                />
              </div>
            </div>
            <div>
              <Label>Link APK *</Label>
              <Input
                value={form.apkUrl}
                onChange={(e) => setForm({ ...form, apkUrl: e.target.value })}
                placeholder="https://…/rinova-1.1.apk"
              />
            </div>
            <div>
              <Label>Changelog (tampil di dialog update)</Label>
              <Textarea
                rows={3}
                value={form.changelog}
                onChange={(e) => setForm({ ...form, changelog: e.target.value })}
                placeholder={'cth.\n- Perbaikan bug komentar\n- Tampilan baru'}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.mandatory}
                  onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
                  className="h-4 w-4 accent-rose-600"
                />
                Wajib update (aplikasi diblokir sampai user mengupdate)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="h-4 w-4 accent-violet-600"
                />
                Langsung tayangkan
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
    </div>
  )
}
