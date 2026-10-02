import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { appUsersCol } from '@/models/AppUser'
import { premiumGrantsCol } from '@/models/PremiumGrant'
import { setUserPremium, UserNotFoundError } from '@/lib/app-writes'
import { toPlain } from '@/lib/serialize'

/**
 * Cabut otomatis premium yang sudah lewat tanggal (lazy, tanpa cron).
 * Dijalankan setiap tab premium dibuka.
 */
async function sweepExpiredPremium() {
  const Users = await appUsersCol()
  const now = new Date()
  const expired = await Users.find(
    { isPremium: true, premiumExpiresAt: { $lte: now } },
    { projection: { uid: 1, email: 1, name: 1, username: 1 } },
  ).toArray()

  for (const u of expired) {
    await setUserPremium(u.uid, {
      isPremium: false,
      note: 'Kedaluwarsa otomatis oleh sistem',
      by: 'system',
    }).catch(() => {})
  }
  return expired.length
}

/**
 * GET /api/admin/premium?tab=aktif|riwayat&search=&page=&limit=
 * - aktif: user dengan isPremium=true (+ paket dari grant terakhir)
 * - riwayat: log premium_grants
 */
export async function GET(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    await sweepExpiredPremium()

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') === 'riwayat' ? 'riwayat' : 'aktif'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const rx = search
      ? { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      : null

    if (tab === 'riwayat') {
      const Grants = await premiumGrantsCol()
      const filter: Record<string, unknown> = {}
      if (rx) filter.$or = [{ userEmail: rx }, { userName: rx }, { uid: rx }]
      const [docs, total] = await Promise.all([
        Grants.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        Grants.countDocuments(filter),
      ])
      return NextResponse.json({
        tab,
        grants: toPlain(docs),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      })
    }

    const Users = await appUsersCol()
    const Grants = await premiumGrantsCol()
    const filter: Record<string, unknown> = { isPremium: true }
    if (rx) filter.$or = [{ email: rx }, { name: rx }, { username: rx }, { uid: rx }]

    const [docs, total] = await Promise.all([
      Users.find(filter, {
        projection: { uid: 1, email: 1, name: 1, username: 1, premiumExpiresAt: 1, updatedAt: 1 },
      })
        .sort({ premiumExpiresAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      Users.countDocuments(filter),
    ])

    // Paket & pemberi dari grant terakhir tiap user
    const enriched = await Promise.all(
      docs.map(async (u) => {
        const last = await Grants.find({ uid: u.uid, action: 'grant' })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray()
        return { ...u, lastPlan: last[0]?.plan, lastBy: last[0]?.createdBy }
      }),
    )

    return NextResponse.json({
      tab,
      users: toPlain(enriched),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (e) {
    console.error('GET /api/admin/premium gagal:', e)
    return serverError('Gagal memuat data premium.')
  }
}

/** Beri / cabut premium user aplikasi. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const uid = String(body?.uid ?? '').trim()
    const action = body?.action
    if (!uid) return NextResponse.json({ error: 'UID user wajib diisi.' }, { status: 400 })

    if (action === 'grant') {
      const plan = body?.plan
      const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null
      if (!['monthly', 'yearly', 'lifetime'].includes(plan)) {
        return NextResponse.json({ error: 'Paket premium tidak valid.' }, { status: 400 })
      }
      if (plan !== 'lifetime' && (!expiresAt || Number.isNaN(+expiresAt))) {
        return NextResponse.json(
          { error: 'Tanggal kedaluwarsa wajib diisi (kecuali lifetime).' },
          { status: 400 },
        )
      }
      await setUserPremium(uid, {
        isPremium: true,
        plan,
        expiresAt,
        note: typeof body?.note === 'string' ? body.note : undefined,
        by: staff.email,
      })
    } else if (action === 'revoke') {
      await setUserPremium(uid, {
        isPremium: false,
        note: typeof body?.note === 'string' ? body.note : undefined,
        by: staff.email,
      })
    } else {
      return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof UserNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    console.error('POST /api/admin/premium gagal:', e)
    return serverError('Gagal memproses premium.')
  }
}
