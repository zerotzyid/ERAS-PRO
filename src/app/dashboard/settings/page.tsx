'use client'

import { useCallback, useEffect, useState } from 'react'
import { Database, Loader2, Plus, Trash2 } from 'lucide-react'
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
  useToast,
} from '@/components/ui'
import { formatDate } from '@/lib/format'

type AdminUser = {
  _id: string
  email: string
  name: string
  role: string
  createdAt: string
}

type DbInfo = { name: string; uri: string; connected: boolean }

export default function SettingsPage() {
  const toast = useToast()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [adminDb, setAdminDb] = useState<DbInfo | null>(null)
  const [appDb, setAppDb] = useState<DbInfo | null>(null)
  const [agentEndpoint, setAgentEndpoint] = useState('/agent')
  const [agentKey, setAgentKey] = useState<string | null>(null)
  const [agentConfigured, setAgentConfigured] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'moderator' })
  const [saving, setSaving] = useState(false)

  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [changing, setChanging] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, sRes] = await Promise.all([
        fetch('/api/admin/admins'),
        fetch('/api/admin/settings'),
      ])
      const aData = await aRes.json()
      const sData = await sRes.json()
      if (!aRes.ok) throw new Error(aData.error || 'Gagal memuat admin.')
      if (!sRes.ok) throw new Error(sData.error || 'Gagal memuat info.')
      setAdmins(aData.admins)
      setAdminDb(sData.adminDb)
      setAppDb(sData.appDb)
      setAgentEndpoint(sData.agent?.endpoint || '/agent')
      setAgentKey(typeof sData.agent?.apiKey === 'string' ? sData.agent.apiKey : null)
      setAgentConfigured(!!sData.agent?.configured)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memuat pengaturan.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const addAdmin = async () => {
    if (!form.email.trim() || !form.name.trim() || form.password.length < 8) {
      toast('Lengkapi email, nama, dan password (min. 8 karakter).', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menambah akun.')
      toast('Akun ditambahkan.')
      setShowAdd(false)
      setForm({ email: '', name: '', password: '', role: 'moderator' })
      fetchAll()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menambah akun.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeAdmin = async (a: AdminUser) => {
    if (!confirm(`Hapus akun ${a.email}?`)) return
    try {
      const res = await fetch(`/api/admin/admins/${a._id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus.')
      toast('Akun dihapus.')
      fetchAll()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menghapus.', 'error')
    }
  }

  const changePassword = async () => {
    if (newPw.length < 8) {
      toast('Password baru minimal 8 karakter.', 'error')
      return
    }
    setChanging(true)
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal mengganti password.')
      toast('Password diganti.')
      setOldPw('')
      setNewPw('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengganti password.', 'error')
    } finally {
      setChanging(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-slate-400">Koneksi database & akun pengelola panel.</p>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Database className="h-4 w-4" /> Koneksi Database
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            { label: 'Database Admin (akun panel)', info: adminDb },
            { label: 'Database Aplikasi (data Rinova)', info: appDb },
          ].map((d) => (
            <div key={d.label} className="rounded-lg bg-slate-800/60 px-4 py-3">
              <p className="text-xs text-slate-500">{d.label}</p>
              <div className="mt-1 flex items-center gap-2">
                <Chip color={d.info?.connected ? 'green' : 'red'}>
                  {d.info?.connected ? 'Terhubung' : 'Gagal'}
                </Chip>
                <code className="text-sm font-semibold">{d.info?.name}</code>
              </div>
              <code className="mt-1 block truncate text-xs text-slate-500" title={d.info?.uri}>
                {d.info?.uri}
              </code>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Akses Agen AI</h2>
        <p className="mt-1 text-sm text-slate-400">
          Endpoint <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">{agentEndpoint}</code>{' '}
          memungkinkan AI/automasi mengelola panel via API key. Buka manifest publik untuk daftar aksi.
        </p>
        <div className="mt-3 rounded-lg bg-slate-800/60 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Status:</span>
            <Chip color={agentConfigured ? 'green' : 'red'}>
              {agentConfigured ? 'Aktif' : 'Belum dikonfigurasi (isi AGENT_API_KEY)'}
            </Chip>
          </div>
          {agentKey ? (
            <div className="mt-2">
              <p className="text-xs text-slate-500">API key (rahasia — hanya terlihat oleh admin):</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-slate-900 px-2 py-1 font-mono text-xs text-amber-300">
                  {showKey ? agentKey : '•'.repeat(24)}
                </code>
                <Button size="sm" variant="secondary" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? 'Sembunyikan' : 'Tampilkan'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(agentKey).catch(() => {})
                    toast('API key disalin.')
                  }}
                >
                  Salin
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Contoh pakai (curl):</p>
              <code className="mt-1 block overflow-x-auto rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-300">
                {'curl -X POST /agent -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" -d \'{"action":"ping"}\''}
              </code>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              API key hanya ditampilkan untuk role admin.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <h2 className="font-semibold">Akun Pengelola</h2>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>
        {admins.length === 0 ? (
          <EmptyState message="Belum ada akun." />
        ) : (
          <ul className="divide-y divide-slate-800">
            {admins.map((a) => (
              <li key={a._id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {a.email} · sejak {formatDate(a.createdAt)}
                  </p>
                </div>
                <Chip color={a.role === 'admin' ? 'violet' : 'blue'}>
                  {a.role === 'admin' ? 'Admin' : 'Moderator'}
                </Chip>
                <button
                  onClick={() => removeAdmin(a)}
                  title="Hapus akun"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Ganti Password Saya</h2>
        <div className="mt-3 grid max-w-lg gap-3">
          <div>
            <Label>Password lama</Label>
            <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
          </div>
          <div>
            <Label>Password baru (min. 8 karakter)</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <div>
            <Button onClick={changePassword} disabled={changing}>
              {changing && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Password
            </Button>
          </div>
        </div>
      </Card>

      {showAdd && (
        <Modal title="Tambah Akun" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div>
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Password (min. 8 karakter)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="moderator">Moderator (kelola konten)</option>
                <option value="admin">Admin (akses penuh)</option>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => setShowAdd(false)} className="flex-1">
                Batal
              </Button>
              <Button onClick={addAdmin} disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Tambah
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
