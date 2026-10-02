import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { appUsersCol } from '@/models/AppUser'
import { announcementsCol } from '@/models/Announcement'
import type { AnnouncementAudience, AnnouncementType } from '@/models/Announcement'
import { appUpdatesCol } from '@/models/AppUpdate'
import { badgesCol } from '@/models/Badge'
import type { BadgeType } from '@/models/Badge'
import { bansCol } from '@/models/Ban'
import { premiumGrantsCol } from '@/models/PremiumGrant'
import {
  setUserBadge,
  setUserPremium,
  updateUserProfile,
  UserNotFoundError,
} from '@/lib/app-writes'
import { BanActionError, createBanRecord, revokeBanRecord } from '@/lib/ban-actions'
import { connectAppDB } from '@/lib/db'
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
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const BADGE_TYPES = ['role', 'achievement', 'special', 'verification']

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
  {
    name: 'users.list',
    description: 'Daftar user aplikasi + filter + pagination (seperti halaman Pengguna).',
    params: {
      search: 'string opsional (email/nama/username/uid)',
      status: 'active|suspended|banned opsional',
      premium: 'boolean opsional (true=premium saja)',
      page: 'number (default 1)',
      limit: 'number 1-50 (default 20)',
    },
  },
  {
    name: 'users.detail',
    description: 'Detail satu user + jumlah bookmark & riwayat nonton.',
    params: { uid: 'string* (Firebase UID)' },
  },
  {
    name: 'users.updateProfile',
    description: 'Ubah nama/username tampilan user.',
    params: { uid: 'string*', name: 'string opsional', username: 'string opsional' },
  },
  {
    name: 'bans.list',
    description: 'Daftar ban/suspend + filter (tanpa sweep otomatis).',
    params: {
      active: 'boolean opsional (true=aktif saja)',
      type: 'ban|suspend opsional',
      search: 'string opsional (email/nama/uid)',
      page: 'number (default 1)',
      limit: 'number 1-50 (default 20)',
    },
  },
  {
    name: 'premium.active',
    description: 'Daftar user premium aktif + paket terakhir.',
    params: { search: 'string opsional', page: 'number (default 1)', limit: 'number 1-50 (default 20)' },
  },
  {
    name: 'premium.history',
    description: 'Riwayat pemberian/pencabutan premium.',
    params: { search: 'string opsional', page: 'number (default 1)', limit: 'number 1-50 (default 20)' },
  },
  {
    name: 'badges.list',
    description: 'Daftar definisi badge + jumlah pemakai.',
    params: {},
  },
  {
    name: 'badges.create',
    description: 'Buat definisi badge baru.',
    params: {
      name: 'string* (huruf besar, unik)',
      description: 'string opsional',
      color: 'string hex #RRGGBB (default #8B5CF6)',
      type: 'role|achievement|special|verification (default role)',
    },
  },
  {
    name: 'badges.update',
    description: 'Ubah definisi badge (nama tidak bisa diubah).',
    params: {
      id: 'string* (ID badge)',
      description: 'string opsional',
      color: 'string hex #RRGGBB opsional',
      type: 'role|achievement|special|verification opsional',
      isActive: 'boolean opsional',
    },
  },
  {
    name: 'badges.delete',
    description: 'Hapus definisi badge + lepas dari semua pemakai.',
    params: { id: 'string* (ID badge)' },
  },
  {
    name: 'announcements.update',
    description: 'Ubah/tayangkan/hentikan pengumuman.',
    params: {
      id: 'string* (ID pengumuman)',
      title: 'string opsional',
      content: 'string opsional',
      type: 'info|warning|success|error opsional',
      targetAudience: 'all|free|premium opsional',
      isPublished: 'boolean opsional',
      expiresAt: 'string tanggal ISO, atau null/kosong untuk hapus batas',
    },
  },
  {
    name: 'announcements.delete',
    description: 'Hapus pengumuman.',
    params: { id: 'string* (ID pengumuman)' },
  },
  {
    name: 'app_updates.list',
    description: 'Semua rilisan + rilisan tayang terbaru.',
    params: {},
  },
  {
    name: 'app_updates.update',
    description: 'Ubah/tayangkan/tarik rilisan.',
    params: {
      id: 'string* (ID rilisan)',
      versionName: 'string opsional',
      apkUrl: 'string URL opsional',
      changelog: 'string opsional',
      mandatory: 'boolean opsional',
      isPublished: 'boolean opsional',
    },
  },
  {
    name: 'app_updates.delete',
    description: 'Hapus rilisan.',
    params: { id: 'string* (ID rilisan)' },
  },
  {
    name: 'stats.overview',
    description: 'Statistik ringkas + user terbaru + ban terbaru (seperti Beranda).',
    params: {},
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
  const num = (v: unknown, def: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : def
  }
  const pageParams = () => {
    const page = Math.max(1, Math.floor(num(params.page, 1)))
    const limit = Math.min(50, Math.max(1, Math.floor(num(params.limit, 20))))
    return { page, limit }
  }
  const paged = (page: number, limit: number, total: number) => ({
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  })
  const escRx = (s: string) => ({
    $regex: s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    $options: 'i',
  })
  const oid = (id: string) => {
    if (!ObjectId.isValid(id)) throw new AgentError('ID tidak valid.')
    return new ObjectId(id)
  }

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

      case 'users.list': {
        const { page, limit } = pageParams()
        const search = str(params.search).trim()
        const status = str(params.status)
        const ands: Record<string, unknown>[] = []
        if (search) {
          const rx = escRx(search)
          ands.push({ $or: [{ email: rx }, { name: rx }, { username: rx }, { uid: rx }] })
        }
        if (status === 'active') {
          ands.push({ $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }] })
        } else if (status === 'suspended' || status === 'banned') {
          ands.push({ status })
        } else if (status) {
          throw new AgentError('status tidak valid.')
        }
        if (typeof params.premium === 'boolean') {
          ands.push(params.premium ? { isPremium: true } : { isPremium: { $ne: true } })
        }
        const filter = ands.length > 0 ? { $and: ands } : {}
        const Users = await appUsersCol()
        const [docs, total] = await Promise.all([
          Users.find(filter, {
            projection: {
              uid: 1, email: 1, name: 1, username: 1, isPremium: 1, premiumExpiresAt: 1,
              status: 1, badgeText: 1, badgeColor: 1, level: 1, updatedAt: 1,
            },
          })
            .sort({ _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray(),
          Users.countDocuments(filter),
        ])
        const users = toPlain(docs).map((u: Record<string, unknown>) => ({
          ...u,
          status: (u.status as string) || 'active',
          joinedAt: joinedFromObjectId(u._id),
        }))
        return NextResponse.json({ ok: true, data: { users, pagination: paged(page, limit, total) } })
      }

      case 'users.detail': {
        const uid = str(params.uid).trim()
        if (!uid) throw new AgentError('uid wajib diisi.')
        const Users = await appUsersCol()
        const user = await Users.findOne({ uid })
        if (!user) throw new UserNotFoundError(uid)
        const db = await connectAppDB()
        const [bookmarkCount, historyCount] = await Promise.all([
          db.collection('bookmarks').countDocuments({ uid }),
          db.collection('watch_history').countDocuments({ uid }),
        ])
        const plain = toPlain(user) as Record<string, unknown>
        return NextResponse.json({
          ok: true,
          data: {
            user: {
              ...plain,
              status: (plain.status as string) || 'active',
              joinedAt: joinedFromObjectId(plain._id),
              bookmarkCount,
              historyCount,
            },
          },
        })
      }

      case 'users.updateProfile': {
        const uid = str(params.uid).trim()
        const name = str(params.name).trim() || undefined
        const username = str(params.username).trim() || undefined
        if (!uid) throw new AgentError('uid wajib diisi.')
        if (name === undefined && username === undefined) {
          throw new AgentError('name / username minimal satu diisi.')
        }
        await updateUserProfile(uid, { name, username })
        return NextResponse.json({ ok: true, data: { uid } })
      }

      case 'bans.list': {
        const { page, limit } = pageParams()
        const search = str(params.search).trim()
        const type = str(params.type)
        const filter: Record<string, unknown> = {}
        if (typeof params.active === 'boolean') filter.isActive = params.active
        if (type === 'ban' || type === 'suspend') filter.type = type
        else if (type) throw new AgentError('type tidak valid.')
        if (search) {
          const rx = escRx(search)
          filter.$or = [{ userEmail: rx }, { userName: rx }, { uid: rx }]
        }
        const Ban = await bansCol()
        const [docs, total] = await Promise.all([
          Ban.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
          Ban.countDocuments(filter),
        ])
        return NextResponse.json({ ok: true, data: { bans: toPlain(docs), pagination: paged(page, limit, total) } })
      }

      case 'premium.active': {
        const { page, limit } = pageParams()
        const search = str(params.search).trim()
        const filter: Record<string, unknown> = { isPremium: true }
        if (search) {
          const rx = escRx(search)
          filter.$or = [{ email: rx }, { name: rx }, { username: rx }, { uid: rx }]
        }
        const Users = await appUsersCol()
        const Grants = await premiumGrantsCol()
        const [docs, total] = await Promise.all([
          Users.find(filter, {
            projection: { uid: 1, email: 1, name: 1, username: 1, premiumExpiresAt: 1 },
          })
            .sort({ premiumExpiresAt: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray(),
          Users.countDocuments(filter),
        ])
        const users = await Promise.all(
          docs.map(async (u) => {
            const last = await Grants.find({ uid: u.uid, action: 'grant' })
              .sort({ createdAt: -1 })
              .limit(1)
              .toArray()
            return { ...u, lastPlan: last[0]?.plan, lastBy: last[0]?.createdBy }
          }),
        )
        return NextResponse.json({ ok: true, data: { users: toPlain(users), pagination: paged(page, limit, total) } })
      }

      case 'premium.history': {
        const { page, limit } = pageParams()
        const search = str(params.search).trim()
        const filter: Record<string, unknown> = {}
        if (search) {
          const rx = escRx(search)
          filter.$or = [{ userEmail: rx }, { userName: rx }, { uid: rx }]
        }
        const Grants = await premiumGrantsCol()
        const [docs, total] = await Promise.all([
          Grants.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
          Grants.countDocuments(filter),
        ])
        return NextResponse.json({ ok: true, data: { grants: toPlain(docs), pagination: paged(page, limit, total) } })
      }

      case 'badges.list': {
        const Badge = await badgesCol()
        const Users = await appUsersCol()
        const docs = await Badge.find({}).sort({ createdAt: -1 }).toArray()
        const badges = await Promise.all(
          docs.map(async (b) => ({
            ...b,
            assignedCount: await Users.countDocuments({ badgeText: b.name }),
          })),
        )
        return NextResponse.json({ ok: true, data: { badges: toPlain(badges) } })
      }

      case 'badges.create': {
        const name = str(params.name).trim().toUpperCase()
        const description = str(params.description).trim()
        const color = (str(params.color).trim() || '#8B5CF6').toUpperCase()
        const type = str(params.type) || 'role'
        if (!name) throw new AgentError('name wajib diisi.')
        if (!HEX_RE.test(color)) throw new AgentError('color harus format #RRGGBB.')
        if (!BADGE_TYPES.includes(type)) throw new AgentError('type tidak valid.')
        const Badge = await badgesCol()
        if (await Badge.findOne({ name }, { projection: { _id: 1 } })) {
          throw new AgentError(`Badge "${name}" sudah ada.`)
        }
        const now = new Date()
        const r = await Badge.insertOne({
          name,
          ...(description ? { description } : {}),
          color,
          type: type as BadgeType,
          isActive: true,
          createdBy: actor,
          createdAt: now,
          updatedAt: now,
        })
        return NextResponse.json({ ok: true, data: { id: String(r.insertedId) } }, { status: 201 })
      }

      case 'badges.update': {
        const _id = oid(str(params.id))
        const setDoc: Record<string, unknown> = { updatedAt: new Date() }
        if (params.description !== undefined) setDoc.description = str(params.description)
        if (params.isActive !== undefined) setDoc.isActive = params.isActive === true
        if (params.color !== undefined) {
          const color = str(params.color).trim().toUpperCase()
          if (!HEX_RE.test(color)) throw new AgentError('color harus format #RRGGBB.')
          setDoc.color = color
        }
        if (params.type !== undefined) {
          if (!BADGE_TYPES.includes(str(params.type))) throw new AgentError('type tidak valid.')
          setDoc.type = str(params.type)
        }
        const Badge = await badgesCol()
        const res = await Badge.updateOne({ _id }, { $set: setDoc })
        if (res.matchedCount === 0) throw new AgentError('Badge tidak ditemukan.')
        return NextResponse.json({ ok: true, data: { id: String(_id) } })
      }

      case 'badges.delete': {
        const _id = oid(str(params.id))
        const Badge = await badgesCol()
        const badge = await Badge.findOne({ _id })
        if (!badge) throw new AgentError('Badge tidak ditemukan.')
        await Badge.deleteOne({ _id })
        const Users = await appUsersCol()
        const cleared = await Users.updateMany(
          { badgeText: badge.name },
          { $unset: { badgeText: '', badgeColor: '' }, $set: { updatedAt: Date.now() } },
        )
        return NextResponse.json({ ok: true, data: { clearedCount: cleared.modifiedCount } })
      }

      case 'announcements.update': {
        const _id = oid(str(params.id))
        const A = await announcementsCol()
        const existing = await A.findOne({ _id })
        if (!existing) throw new AgentError('Pengumuman tidak ditemukan.')
        const setDoc: Record<string, unknown> = { updatedAt: new Date() }
        const unsetDoc: Record<string, ''> = {}
        if (params.title !== undefined) {
          const t = str(params.title).trim()
          if (!t) throw new AgentError('title tidak boleh kosong.')
          setDoc.title = t
        }
        if (params.content !== undefined) {
          const c = str(params.content).trim()
          if (!c) throw new AgentError('content tidak boleh kosong.')
          setDoc.content = c
        }
        if (params.type !== undefined) {
          if (!TYPES.includes(str(params.type))) throw new AgentError('type tidak valid.')
          setDoc.type = str(params.type)
        }
        if (params.targetAudience !== undefined) {
          if (!AUDIENCES.includes(str(params.targetAudience))) throw new AgentError('targetAudience tidak valid.')
          setDoc.targetAudience = str(params.targetAudience)
        }
        if (params.isPublished !== undefined) {
          const pub = params.isPublished === true
          setDoc.isPublished = pub
          if (pub && !existing.publishedAt) setDoc.publishedAt = new Date()
        }
        if (params.expiresAt !== undefined) {
          const raw = str(params.expiresAt)
          if (raw) {
            const exp = new Date(raw)
            if (Number.isNaN(+exp)) throw new AgentError('expiresAt tidak valid.')
            setDoc.expiresAt = exp
          } else {
            unsetDoc.expiresAt = ''
          }
        }
        const update: Record<string, unknown> = { $set: setDoc }
        if (Object.keys(unsetDoc).length > 0) update.$unset = unsetDoc
        await A.updateOne({ _id }, update)
        const updated = await A.findOne({ _id })
        return NextResponse.json({ ok: true, data: { announcement: toPlain(updated) } })
      }

      case 'announcements.delete': {
        const _id = oid(str(params.id))
        const A = await announcementsCol()
        const res = await A.deleteOne({ _id })
        if (res.deletedCount === 0) throw new AgentError('Pengumuman tidak ditemukan.')
        return NextResponse.json({ ok: true, data: { id: String(_id) } })
      }

      case 'app_updates.list': {
        const U = await appUpdatesCol()
        const [docs, latest] = await Promise.all([
          U.find({}).sort({ versionCode: -1 }).toArray(),
          U.find({ isPublished: true }).sort({ versionCode: -1 }).limit(1).toArray(),
        ])
        return NextResponse.json({
          ok: true,
          data: { updates: toPlain(docs), latestPublished: toPlain(latest[0] ?? null) },
        })
      }

      case 'app_updates.update': {
        const _id = oid(str(params.id))
        const U = await appUpdatesCol()
        const existing = await U.findOne({ _id })
        if (!existing) throw new AgentError('Rilisan tidak ditemukan.')
        const setDoc: Record<string, unknown> = { updatedAt: new Date() }
        if (params.versionName !== undefined) {
          const v = str(params.versionName).trim()
          if (!v) throw new AgentError('versionName tidak boleh kosong.')
          setDoc.versionName = v
        }
        if (params.apkUrl !== undefined) {
          const url = str(params.apkUrl).trim()
          try {
            const u = new URL(url)
            if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
          } catch {
            throw new AgentError('apkUrl tidak valid.')
          }
          setDoc.apkUrl = url
        }
        if (params.changelog !== undefined) setDoc.changelog = str(params.changelog)
        if (params.mandatory !== undefined) setDoc.mandatory = params.mandatory === true
        if (params.isPublished !== undefined) {
          const pub = params.isPublished === true
          setDoc.isPublished = pub
          if (pub && !existing.publishedAt) setDoc.publishedAt = new Date()
        }
        await U.updateOne({ _id }, { $set: setDoc })
        return NextResponse.json({ ok: true, data: { id: String(_id) } })
      }

      case 'app_updates.delete': {
        const _id = oid(str(params.id))
        const U = await appUpdatesCol()
        const res = await U.deleteOne({ _id })
        if (res.deletedCount === 0) throw new AgentError('Rilisan tidak ditemukan.')
        return NextResponse.json({ ok: true, data: { id: String(_id) } })
      }

      case 'stats.overview': {
        const AppUser = await appUsersCol()
        const Ban = await bansCol()
        const Announcement = await announcementsCol()
        const Badge = await badgesCol()
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const [total, premium, banned, suspended, active7d, activeBans, published, activeBadges] =
          await Promise.all([
            AppUser.countDocuments({}),
            AppUser.countDocuments({ isPremium: true }),
            AppUser.countDocuments({ status: 'banned' }),
            AppUser.countDocuments({ status: 'suspended' }),
            AppUser.countDocuments({ updatedAt: { $gte: weekAgo } }),
            Ban.countDocuments({ isActive: true }),
            Announcement.countDocuments({ isPublished: true }),
            Badge.countDocuments({ isActive: true }),
          ])
        const recentUsersRaw = await AppUser.find(
          {},
          { projection: { uid: 1, email: 1, name: 1, username: 1, isPremium: 1, status: 1 } },
        )
          .sort({ _id: -1 })
          .limit(5)
          .toArray()
        const recentUsers = toPlain(recentUsersRaw).map((u: Record<string, unknown>) => ({
          ...u,
          joinedAt: joinedFromObjectId(u._id),
        }))
        const recentBansRaw = await Ban.find({}).sort({ createdAt: -1 }).limit(5).toArray()
        return NextResponse.json({
          ok: true,
          data: {
            stats: { total, premium, banned, suspended, active7d, activeBans, published, activeBadges },
            recentUsers,
            recentBans: toPlain(recentBansRaw),
          },
        })
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
