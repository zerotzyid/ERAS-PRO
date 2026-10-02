import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { badgesCol } from '@/models/Badge'
import { appUsersCol } from '@/models/AppUser'

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const TYPES = ['role', 'achievement', 'special', 'verification']

function validId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

/** Ubah definisi badge. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const _id = validId(params.id)
    if (!_id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const setDoc: Record<string, unknown> = { updatedAt: new Date() }

    if (body?.description !== undefined) setDoc.description = String(body.description)
    if (body?.isActive !== undefined) setDoc.isActive = body.isActive === true
    if (body?.color !== undefined) {
      const color = String(body.color).trim().toUpperCase()
      if (!HEX_RE.test(color)) {
        return NextResponse.json({ error: 'Warna harus format hex #RRGGBB.' }, { status: 400 })
      }
      setDoc.color = color
    }
    if (body?.type !== undefined) {
      if (!TYPES.includes(body.type)) {
        return NextResponse.json({ error: 'Tipe badge tidak valid.' }, { status: 400 })
      }
      setDoc.type = body.type
    }
    // Nama badge tidak bisa diubah (dipakai sebagai badgeText di dokumen user).

    const Badge = await badgesCol()
    const result = await Badge.updateOne({ _id }, { $set: setDoc })
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Badge tidak ditemukan.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PUT /api/admin/badges/[id] gagal:', e)
    return serverError('Gagal mengubah badge.')
  }
}

/** Hapus definisi badge + lepas dari semua user yang memakainya. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const _id = validId(params.id)
    if (!_id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })

    const Badge = await badgesCol()
    const badge = await Badge.findOne({ _id })
    if (!badge) {
      return NextResponse.json({ error: 'Badge tidak ditemukan.' }, { status: 404 })
    }

    await Badge.deleteOne({ _id })

    const Users = await appUsersCol()
    const cleared = await Users.updateMany(
      { badgeText: badge.name },
      {
        $unset: { badgeText: '', badgeColor: '' },
        $set: { updatedAt: Date.now() },
      },
    )

    return NextResponse.json({ ok: true, clearedCount: cleared.modifiedCount })
  } catch (e) {
    console.error('DELETE /api/admin/badges/[id] gagal:', e)
    return serverError('Gagal menghapus badge.')
  }
}
