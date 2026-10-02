import { NextRequest, NextResponse } from 'next/server'
import { appUsersCol } from '@/models/AppUser'
import { announcementsCol } from '@/models/Announcement'
import type { AnnouncementAudience, AnnouncementType } from '@/models/Announcement'
import { appUpdatesCol } from '@/models/AppUpdate'
import {
  setUserBadge,
  setUserPremium,
  UserNotFoundError,
} from '@/lib/app-writes'
import { BanActionError, createBanRecord, revokeBanRecord } from '@/lib/ban-actions'
import { joinedFromObjectId, toPlain } from '@/lib/serialize'

/**
 * Endpoint untuk AI agent / otomasi.
 * - GET  /agent → manifest publik (daftar aksi + skema parameter)
 * - POST /agent → { action, params?, actor? } dengan header
 *   `Authorization: Bearer AGENT_API_KEY`
 */
export const dynamic = 'force-dynamic'

const TYPES = ['info', 'warning', 'success', 'error']
const AUDIENCES = ['all', 'free', 'premium']
const PLANS = ['monthly', 'yearly', 'lifetime']

type ActionDef = {
  name: string
  description: string
  params: Record<string, string>
}

const ACTIONS: ActionDef[] = [
  { name: 'ping', description: 'Tes koneksi & auth.', params: {} },
  {
    name: 'announcements.create',
    description: 'Buat pengumuman untuk aplikasi.',
    params: {
      title: 'string* (judul)',
      content: 'string* (isi)',
      type: 'info|warning|success|error (default info)',
      targetAudience: 'all|free|premium (default all)',
      isPublished: 'boolean (default true)',
      expiresAt: 'string tanggal ISO opsional',
    },
  },
  {
    name: 'announcements.list',
    description: 'Daftar pengumuman terbaru.',
    params: { publishedOnly: 'boolean (default false)', limit: 'number 1-50 (default 10)' },
  },
  {
    name: 'app_updates.publish',
    description: 'Terbitkan rilisan update aplikasi (langsung tayang).',
    params: {
      versionCode: 'number* (bulat, > versi terpasang)',
      versionName: 'string* (cth. 1.1)',
      apkUrl: 'string* URL http/https',
      changelog: 'string opsional',
      mandatory: 'boolean (default false)',
    },
  },
  { name: 'app_updates.latest', description: 'Rilisan tayang terbaru.', params: {} },
  {
    name: 'users.lookup',
    description: 'Cari user aplikasi (maks 10 hasil, field terbatas).',
    params: { query: 'string* (email/nama/username/uid)' },
  },
  {
    name: 'users.setPremium',
    description: 'Beri/cabut premium user.',
    params: {
      uid: 'string* (Firebase UID)',
      grant: 'boolean* (true=beri, false=cabut)',
      plan: 'monthly|yearly|lifetime (wajib bila grant)',
      expiresAt: 'string tanggal ISO (wajib bila grant non-lifetime)',
      note: 'string opsional',
    },
  },
  {
    name: 'users.setBadge',
    description: 'Pasang/lepas badge user.',
    params: {
      uid: 'string* (Firebase UID)',
      name: 'string (kosongkan untuk melepas)',
      color: 'string hex #RRGGBB (default #8B5CF6)',
    },
  },
  {
    name: 'bans.create',
    description: 'Blokir/suspend user.',
    params: {
      uid: 'string* (Firebase UID)',
      type: 'ban|suspend*',
      reason: 'string* (alasan)',
      expiresAt: 'string tanggal ISO (suspend berjangka)',
    },
  },
  {
    name: 'bans.revoke',
    description: 'Cabut ban/suspend berdasar ID riwayat.',
    params: { id: 'string* (ID dokumen ban)' },
  },
]

export async function GET() {
  return NextResponse.json(
    {
      service: 'rinova-web-control',
      version: '1.0.0',
      auth: {
        scheme: 'bearer',
        header: 'Authorization: Bearer AGENT_API_KEY',
        how: 'Minta API key ke admin panel (Pengaturan → Akses Agen AI). Kunci disimpan di env AGENT_API_KEY.',
      },
      usage: 'POST /agent dengan body {"action": "<nama>", "params": {...}, "actor": "nama-agen-opsional"}',
      actions: ACTIONS,
      notes: [
        'Semua aksi ban/premium/badge menulis langsung ke database aplikasi dan berlaku di HP.',
        'Penulisan tanggal kedaluwarsa memakai tipe Date; kosongkan untuk tanpa batas.',
        'Rate wajar; tidak ada cron — kedaluwarsa diproses lazy oleh web.',
      ],
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}

function unauthorized(message = 'API key tidak valid.') {
  return NextResponse.json({ ok: false, error: message }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const configured = process.env.AGENT_API_KEY || ''
  if (!configured) {
    return NextResponse.json(
      { ok: false, error: 'AGENT_API_KEY belum dikonfigurasi di server.' },
      { status: 503 },
    )
  }
  const header = req.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== configured) return unauthorized()

  const body = await req.json().catch(() => null)
  const action = body?.action as string
  const params = (body?.params ?? {}) as Record<string, unknown>
  const actor = typeof body?.actor === 'string' && body.actor.trim()
    ? `agent:${body.actor.trim().slice(0, 40)}`
    : 'agent'
  const str = (v: unknown) => (typeof v === 'string' ? v : '')

  try {
    switch (action) {
      case 'ping': {
        return NextResponse.json({ ok: true, data: { time: new Date().toISOString(), actor } })
      }

      case 'announcements.create': {
        const title = str(params.title).trim()
        const content = str(params.content).trim()
        const type = str(params.type) || 'info'
        const targetAudience = str(params.targetAudience) || 'all'
        if (!title || !content) throw new AgentError('title & content wajib diisi.')
        if (!TYPES.includes(type)) throw new AgentError('type tidak valid.')
        if (!AUDIENCES.includes(targetAudience)) throw new AgentError('targetAudience tidak valid.')
        const expiresAt = str(params.expiresAt) ? new Date(str(params.expiresAt)) : null
        if (expiresAt && Number.isNaN(+expiresAt)) throw new AgentError('expiresAt tidak valid.')
        const isPublished = params.isPublished !== false
        const now = new Date()
        const A = await announcementsCol()
        const r = await A.insertOne({
          title,
          content,
          type: type as AnnouncementType,
          targetAudience: targetAudience as AnnouncementAudience,
          isPublished,
          ...(isPublished ? { publishedAt: now } : {}),
          ...(expiresAt ? { expiresAt } : {}),
          createdBy: actor,
          createdAt: now,
          updatedAt: now,
        })
        return NextResponse.json({ ok: true, data: { id: String(r.insertedId) } }, { status: 201 })
      }

      case 'announcements.list': {
        const limit = Math.min(50, Math.max(1, Number(params.limit) || 10))
        const A = await announcementsCol()
        const docs = await A.find(params.publishedOnly ? { isPublished: true } : {})
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray()
        return NextResponse.json({ ok: true, data: { announcements: toPlain(docs) } })
      }

      case 'app_updates.publish': {
        const versionCode = Number(params.versionCode)
        const versionName = str(params.versionName).trim()
        const apkUrl = str(params.apkUrl).trim()
        if (!Number.isInteger(versionCode) || versionCode < 1) {
          throw new AgentError('versionCode harus angka bulat ≥ 1.')
        }
        if (!versionName) throw new AgentError('versionName wajib diisi.')
        try {
          const u = new URL(apkUrl)
          if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
        } catch {
          throw new AgentError('apkUrl tidak valid.')
        }
        const U = await appUpdatesCol()
        if (await U.findOne({ versionCode }, { projection: { _id: 1 } })) {
          throw new AgentError(`versionCode ${versionCode} sudah dipakai.`)
        }
        const now = new Date()
        const r = await U.insertOne({
          versionCode,
          versionName,
          apkUrl,
          ...(str(params.changelog).trim() ? { changelog: str(params.changelog).trim() } : {}),
          mandatory: params.mandatory === true,
          isPublished: true,
          publishedAt: now,
          createdBy: actor,
          createdAt: now,
          updatedAt: now,
        })
        return NextResponse.json({ ok: true, data: { id: String(r.insertedId) } }, { status: 201 })
      }

      case 'app_updates.latest': {
        const U = await appUpdatesCol()
        const docs = await U.find({ isPublished: true }).sort({ versionCode: -1 }).limit(1).toArray()
        return NextResponse.json({ ok: true, data: { latest: toPlain(docs[0] ?? null) } })
      }

      case 'users.lookup': {
        const q = str(params.query).trim()
        if (!q) throw new AgentError('query wajib diisi.')
        const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
        const Users = await appUsersCol()
        const docs = await Users.find(
          { $or: [{ email: rx }, { name: rx }, { username: rx }, { uid: rx }] } as never,
          {
            projection: {
              uid: 1,
              email: 1,
              name: 1,
              username: 1,
              isPremium: 1,
              status: 1,
              badgeText: 1,
            },
          },
        )
          .limit(10)
          .toArray()
        return NextResponse.json({ ok: true, data: { users: toPlain(docs) } })
      }

      case 'users.setPremium': {
        const uid = str(params.uid).trim()
        const grant = params.grant === true
        if (!uid) throw new AgentError('uid wajib diisi.')
        let plan: 'monthly' | 'yearly' | 'lifetime' | undefined
        let expiresAt: Date | null = null
        if (grant) {
          const p = str(params.plan)
          if (!PLANS.includes(p)) throw new AgentError('plan wajib: monthly|yearly|lifetime.')
          plan = p as typeof plan
          if (plan !== 'lifetime') {
            if (!str(params.expiresAt)) throw new AgentError('expiresAt wajib untuk non-lifetime.')
            expiresAt = new Date(str(params.expiresAt))
            if (Number.isNaN(+expiresAt)) throw new AgentError('expiresAt tidak valid.')
          }
        }
        await setUserPremium(uid, {
          isPremium: grant,
          plan,
          expiresAt,
          note: str(params.note) || undefined,
          by: actor,
        })
        return NextResponse.json({ ok: true, data: { uid, isPremium: grant } })
      }

      case 'users.setBadge': {
        const uid = str(params.uid).trim()
        const name = str(params.name).trim().toUpperCase()
        if (!uid) throw new AgentError('uid wajib diisi.')
        if (!name) {
          await setUserBadge(uid, null)
        } else {
          await setUserBadge(uid, { name, colorHex: str(params.color).trim() || '#8B5CF6' })
        }
        return NextResponse.json({ ok: true, data: { uid, badge: name || null } })
      }

      case 'bans.create': {
        const expiresRaw = str(params.expiresAt)
        const { id } = await createBanRecord({
          uid: str(params.uid),
          type: params.type as 'ban' | 'suspend',
          reason: str(params.reason),
          expiresAt: expiresRaw ? new Date(expiresRaw) : null,
          by: actor,
        })
        return NextResponse.json({ ok: true, data: { id } }, { status: 201 })
      }

      case 'bans.revoke': {
        const { uid } = await revokeBanRecord(str(params.id))
        return NextResponse.json({ ok: true, data: { uid } })
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Aksi tidak dikenal: ${action}. Lihat GET /agent untuk daftar aksi.` },
          { status: 400 },
        )
    }
  } catch (e) {
    if (e instanceof AgentError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 })
    }
    if (e instanceof BanActionError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
    }
    if (e instanceof UserNotFoundError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 404 })
    }
    console.error('POST /agent gagal:', e)
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}

class AgentError extends Error {}
