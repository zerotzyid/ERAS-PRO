'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Label, Modal, Select, Textarea, useToast } from './ui'

type Done = (ok: boolean, message?: string) => void

/* ---------- Modal Ban / Suspend ---------- */

export function BanModal({
  uid,
  userLabel,
  onClose,
  onDone,
}: {
  uid: string
  userLabel: string
  onClose: () => void
  onDone: Done
}) {
  const toast = useToast()
  const [type, setType] = useState<'suspend' | 'ban'>('suspend')
  const [duration, setDuration] = useState('7')
  const [customDate, setCustomDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!reason.trim()) {
      toast('Alasan wajib diisi.', 'error')
      return
    }
    setSaving(true)
    try {
      let expiresAt: string | undefined
      if (type === 'suspend') {
        if (duration === 'custom') {
          if (!customDate) {
            toast('Pilih tanggal berakhir suspend.', 'error')
            setSaving(false)
            return
          }
          expiresAt = new Date(customDate).toISOString()
        } else if (duration !== 'permanent') {
          expiresAt = new Date(Date.now() + Number(duration) * 86400000).toISOString()
        }
      }
      const res = await fetch('/api/admin/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, type, reason: reason.trim(), expiresAt }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal menerapkan ban.')
      onDone(true, type === 'ban' ? 'User diblokir permanen.' : 'User di-suspend.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menerapkan ban.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Ban / Suspend — ${userLabel}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Jenis hukuman</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as 'suspend' | 'ban')}>
            <option value="suspend">Suspend (sementara)</option>
            <option value="ban">Blokir (permanen)</option>
          </Select>
        </div>
        {type === 'suspend' && (
          <div>
            <Label>Durasi</Label>
            <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="1">1 hari</option>
              <option value="7">7 hari</option>
              <option value="30">30 hari</option>
              <option value="custom">Tanggal kustom…</option>
              <option value="permanent">Sampai dicabut manual</option>
            </Select>
            {duration === 'custom' && (
              <Input
                type="datetime-local"
                className="mt-2"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
          </div>
        )}
        <div>
          <Label>Alasan</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="cth. Spam komentar / pelanggaran konten…"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button variant="danger" onClick={submit} disabled={saving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Terapkan
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Modal Premium ---------- */

export function PremiumModal({
  uid,
  userLabel,
  currentPremium,
  onClose,
  onDone,
}: {
  uid: string
  userLabel: string
  currentPremium: { isPremium?: boolean; premiumExpiresAt?: string | null }
  onClose: () => void
  onDone: Done
}) {
  const toast = useToast()
  const [mode, setMode] = useState<'grant' | 'revoke'>(
    currentPremium.isPremium ? 'revoke' : 'grant',
  )
  const [plan, setPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly')
  const [customDate, setCustomDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (plan === 'monthly') {
      setCustomDate(toLocalInput(Date.now() + 30 * 86400000))
    } else if (plan === 'yearly') {
      const d = new Date()
      d.setFullYear(d.getFullYear() + 1)
      setCustomDate(toLocalInput(d.getTime()))
    }
  }, [plan])

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setPremium',
          isPremium: mode === 'grant',
          plan: mode === 'grant' ? plan : undefined,
          expiresAt: mode === 'grant' && plan !== 'lifetime' ? customDate || undefined : undefined,
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal memproses premium.')
      onDone(true, mode === 'grant' ? 'Premium diberikan.' : 'Premium dicabut.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memproses premium.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Premium — ${userLabel}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Aksi</Label>
          <Select value={mode} onChange={(e) => setMode(e.target.value as 'grant' | 'revoke')}>
            <option value="grant">Beri premium</option>
            <option value="revoke">Cabut premium</option>
          </Select>
        </div>
        {mode === 'grant' && (
          <>
            <div>
              <Label>Paket</Label>
              <Select
                value={plan}
                onChange={(e) => setPlan(e.target.value as typeof plan)}
              >
                <option value="monthly">Bulanan (30 hari)</option>
                <option value="yearly">Tahunan</option>
                <option value="lifetime">Lifetime</option>
              </Select>
            </div>
            {plan !== 'lifetime' && (
              <div>
                <Label>Berlaku sampai</Label>
                <Input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              </div>
            )}
          </>
        )}
        <div>
          <Label>Catatan (opsional)</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="cth. Pemenang giveaway…"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button onClick={submit} disabled={saving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Modal Badge ---------- */

type BadgeDef = { name: string; color: string }

export function BadgeModal({
  uid,
  userLabel,
  currentBadge,
  onClose,
  onDone,
}: {
  uid: string
  userLabel: string
  currentBadge?: string | null
  onClose: () => void
  onDone: Done
}) {
  const toast = useToast()
  const [badges, setBadges] = useState<BadgeDef[]>([])
  const [name, setName] = useState(currentBadge || '')
  const [color, setColor] = useState('#8B5CF6')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/badges')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.badges) {
          setBadges(data.badges.map((b: { name: string; color: string }) => ({ name: b.name, color: b.color })))
          const current = (data.badges as { name: string; color: string }[]).find(
            (b) => b.name === currentBadge,
          )
          if (current) setColor(current.color)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickBadge = (n: string) => {
    setName(n)
    const found = badges.find((b) => b.name === n)
    if (found) setColor(found.color)
  }

  const assign = async () => {
    const clean = name.trim().toUpperCase()
    if (!clean) {
      toast('Nama badge wajib diisi.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assignBadge', name: clean, color }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal memasang badge.')
      onDone(true, `Badge "${clean}" dipasang.`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal memasang badge.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearBadge' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Gagal melepas badge.')
      onDone(true, 'Badge dilepas.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal melepas badge.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Badge — ${userLabel}`} onClose={onClose}>
      <div className="space-y-4">
        {badges.length > 0 && (
          <div>
            <Label>Pilih dari daftar</Label>
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <button
                  key={b.name}
                  onClick={() => pickBadge(b.name)}
                  className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={{
                    borderColor: b.color,
                    color: b.color,
                    backgroundColor: name === b.name ? `${b.color}22` : 'transparent',
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <Label>Nama badge</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="cth. VIP"
          />
        </div>
        <div>
          <Label>Warna</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              className="h-10 w-14 cursor-pointer rounded border border-slate-700 bg-slate-800"
            />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-32" />
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}` }}
            >
              {name || 'PREVIEW'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Batal
          </Button>
          {currentBadge && (
            <Button variant="danger" onClick={clear} disabled={saving} className="flex-1">
              Lepas
            </Button>
          )}
          <Button onClick={assign} disabled={saving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Pasang
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
