import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { badgesCol } from '@/models/Badge'
import { setUserBadge, UserNotFoundError } from '@/lib/app-writes'

/** Pasang badge (berdasar definisi) ke user aplikasi. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const uid = String(body?.uid ?? '').trim()
    const name = String(body?.name ?? '').trim().toUpperCase()
    if (!uid || !name) {
      return NextResponse.json({ error: 'UID dan nama badge wajib diisi.' }, { status: 400 })
    }

    const Badge = await badgesCol()
    const badge = await Badge.findOne({ name, isActive: true })
    if (!badge) {
      return NextResponse.json(
        { error: `Badge "${name}" tidak ditemukan / nonaktif.` },
        { status: 404 },
      )
    }

    await setUserBadge(uid, { name: badge.name, colorHex: badge.color })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof UserNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    console.error('POST /api/admin/badges/assign gagal:', e)
    return serverError('Gagal memasang badge.')
  }
}
