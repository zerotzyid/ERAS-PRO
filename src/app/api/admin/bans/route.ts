import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { appUsersCol } from '@/models/AppUser'
import { bansCol } from '@/models/Ban'
import { setUserStatus, UserNotFoundError } from '@/lib/app-writes'
import { toPlain } from '@/lib/serialize'

/**
 * Tandai suspend yang sudah kedaluwarsa sebagai nonaktif + pulihkan user.
 * Dijalankan lazy setiap daftar ban dibuka (tanpa cron — aman untuk Vercel).
 */
async function sweepExpired() {
  const Ban = await bansCol()
  const now = new Date()
  const expired = await Ban.find({
    isActive: true,
    type: 'suspend',
    expiresAt: { $lte: now },
  }).toArray()

  for (const b of expired) {
    await Ban.updateOne(
      { _id: b._id },
      { $set: { isActive: false, revokedAt: now, updatedAt: now } },
    )
    const stillActive = await Ban.countDocuments({ uid: b.uid, isActive: true })
    if (stillActive === 0) {
      await setUserStatus(b.uid, { status: 'active' }).catch(() => {})
    }
  }
  return expired.length
}

/** Daftar ban/suspend + filter + pagination. */
export async function GET(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    await sweepExpired()

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const active = searchParams.get('active') || ''
    const type = searchParams.get('type') || ''
    const search = searchParams.get('search')?.trim() || ''

    const filter: Record<string, unknown> = {}
    if (active === 'true') filter.isActive = true
    else if (active === 'false') filter.isActive = false
    if (type === 'ban' || type === 'suspend') filter.type = type
    if (search) {
      const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [{ userEmail: rx }, { userName: rx }, { uid: rx }]
    }

    const Ban = await bansCol()
    const [docs, total, activeCount] = await Promise.all([
      Ban.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      Ban.countDocuments(filter),
      Ban.countDocuments({ isActive: true }),
    ])

    return NextResponse.json({
      bans: toPlain(docs),
      activeCount,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (e) {
    console.error('GET /api/admin/bans gagal:', e)
    return serverError('Gagal memuat daftar ban.')
  }
}

/** Terapkan ban/suspend ke user aplikasi. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const uid = String(body?.uid ?? '').trim()
    const type = body?.type
    const reason = String(body?.reason ?? '').trim()
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null

    if (!uid) return NextResponse.json({ error: 'UID user wajib diisi.' }, { status: 400 })
    if (type !== 'ban' && type !== 'suspend') {
      return NextResponse.json({ error: 'Jenis tidak valid.' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ error: 'Alasan wajib diisi.' }, { status: 400 })
    }
    if (type === 'suspend' && expiresAt && Number.isNaN(+expiresAt)) {
      return NextResponse.json({ error: 'Tanggal kedaluwarsa tidak valid.' }, { status: 400 })
    }

    const Users = await appUsersCol()
    const user = await Users.findOne(
      { uid },
      { projection: { email: 1, name: 1, username: 1 } },
    )
    if (!user) {
      return NextResponse.json({ error: 'User aplikasi tidak ditemukan.' }, { status: 404 })
    }

    const Ban = await bansCol()
    const existing = await Ban.findOne({ uid, isActive: true })
    if (existing) {
      return NextResponse.json(
        { error: 'User ini sudah memiliki ban/suspend aktif. Cabut dulu sebelum membuat yang baru.' },
        { status: 400 },
      )
    }

    await setUserStatus(uid, {
      status: type === 'ban' ? 'banned' : 'suspended',
      reason,
      expiresAt: type === 'suspend' ? expiresAt : null,
    })

    const now = new Date()
    const result = await Ban.insertOne({
      uid,
      userEmail: user.email,
      userName: user.name ?? user.username,
      type,
      reason,
      expiresAt: type === 'suspend' ? (expiresAt ?? undefined) : undefined,
      createdBy: staff.email,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ ok: true, id: String(result.insertedId) }, { status: 201 })
  } catch (e) {
    if (e instanceof UserNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    console.error('POST /api/admin/bans gagal:', e)
    return serverError('Gagal menerapkan ban.')
  }
}
