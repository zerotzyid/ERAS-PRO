import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { appUsersCol } from '@/models/AppUser'
import { connectAppDB } from '@/lib/db'
import {
  setUserBadge,
  setUserPremium,
  updateUserProfile,
  UserNotFoundError,
} from '@/lib/app-writes'
import { joinedFromObjectId, toPlain } from '@/lib/serialize'

/** Detail satu user aplikasi + jumlah bookmark & riwayat. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { uid: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const uid = decodeURIComponent(params.uid)
    const Users = await appUsersCol()
    const user = await Users.findOne({ uid })
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })
    }

    const db = await connectAppDB()
    const [bookmarkCount, historyCount] = await Promise.all([
      db.collection('bookmarks').countDocuments({ uid }),
      db.collection('watch_history').countDocuments({ uid }),
    ])

    const plain = toPlain(user) as Record<string, unknown>
    return NextResponse.json({
      user: {
        ...plain,
        status: (plain.status as string) || 'active',
        joinedAt: joinedFromObjectId(plain._id),
        bookmarkCount,
        historyCount,
      },
    })
  } catch (e) {
    console.error('GET /api/admin/users/[uid] gagal:', e)
    return serverError('Gagal memuat detail pengguna.')
  }
}

type PatchAction = 'setPremium' | 'assignBadge' | 'clearBadge' | 'updateProfile'

/** Aksi cepat terhadap user aplikasi. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { uid: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const uid = decodeURIComponent(params.uid)
    const body = await req.json().catch(() => null)
    const action = body?.action as PatchAction

    if (action === 'setPremium') {
      const isPremium = body?.isPremium === true
      const plan = body?.plan
      const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null
      if (isPremium && !['monthly', 'yearly', 'lifetime'].includes(plan)) {
        return NextResponse.json({ error: 'Paket premium tidak valid.' }, { status: 400 })
      }
      if (isPremium && plan !== 'lifetime' && !(expiresAt instanceof Date && !Number.isNaN(+expiresAt))) {
        return NextResponse.json(
          { error: 'Tanggal kedaluwarsa wajib diisi (kecuali lifetime).' },
          { status: 400 },
        )
      }
      await setUserPremium(uid, {
        isPremium,
        plan: isPremium ? plan : undefined,
        expiresAt,
        note: typeof body?.note === 'string' ? body.note : undefined,
        by: staff.email,
      })
    } else if (action === 'assignBadge') {
      const name = String(body?.name ?? '').trim().toUpperCase()
      const color = String(body?.color ?? '').trim()
      if (!name) return NextResponse.json({ error: 'Nama badge wajib diisi.' }, { status: 400 })
      await setUserBadge(uid, { name, colorHex: color || '#8B5CF6' })
    } else if (action === 'clearBadge') {
      await setUserBadge(uid, null)
    } else if (action === 'updateProfile') {
      const name = typeof body?.name === 'string' ? body.name.trim() : undefined
      const username = typeof body?.username === 'string' ? body.username.trim() : undefined
      await updateUserProfile(uid, { name, username })
    } else {
      return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 })
    }

    const Users = await appUsersCol()
    const updated = await Users.findOne({ uid })
    const plain = toPlain(updated) as Record<string, unknown> | null
    return NextResponse.json({
      ok: true,
      user: plain ? { ...plain, status: (plain.status as string) || 'active' } : null,
    })
  } catch (e) {
    if (e instanceof UserNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    console.error('PATCH /api/admin/users/[uid] gagal:', e)
    return serverError('Gagal memperbarui pengguna.')
  }
}
