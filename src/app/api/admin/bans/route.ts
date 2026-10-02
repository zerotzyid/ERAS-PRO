import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { bansCol } from '@/models/Ban'
import { UserNotFoundError } from '@/lib/app-writes'
import { BanActionError, createBanRecord, revokeBanRecord } from '@/lib/ban-actions'
import { toPlain } from '@/lib/serialize'

/**
 * Tandai suspend yang sudah kedaluwarsa sebagai nonaktif + pulihkan user.
 * Dijalankan lazy setiap daftar ban dibuka (tanpa cron — aman untuk Vercel).
 *
 * Hanya field bertipe Date yang dianggap tanggal sungguhan; nilai warisan
 * non-Date (null/dll) dibersihkan agar tak merusak perbandingan.
 */
async function sweepExpired() {
  const Ban = await bansCol()
  await Ban.updateMany(
    { isActive: true, expiresAt: { $exists: true, $not: { $type: 'date' } } },
    { $unset: { expiresAt: '' } },
  ).catch(() => {})

  const now = new Date()
  const expired = await Ban.find({
    isActive: true,
    type: 'suspend',
    expiresAt: { $type: 'date', $lte: now },
  }).toArray()

  for (const b of expired) {
    await revokeBanRecord(String(b._id)).catch(() => {})
  }
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
    const { id } = await createBanRecord({
      uid: String(body?.uid ?? ''),
      type: body?.type,
      reason: String(body?.reason ?? ''),
      expiresAt: body?.expiresAt ? new Date(body.expiresAt) : null,
      by: staff.email,
    })
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (e) {
    if (e instanceof BanActionError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    if (e instanceof UserNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    console.error('POST /api/admin/bans gagal:', e)
    return serverError('Gagal menerapkan ban.')
  }
}
