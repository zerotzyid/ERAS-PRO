import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { bansCol } from '@/models/Ban'
import { setUserStatus } from '@/lib/app-writes'

/** Cabut ban/suspend (pulihkan user bila tidak ada ban aktif lain). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })
    }
    const Ban = await bansCol()
    const ban = await Ban.findOne({ _id: new ObjectId(params.id) })
    if (!ban) {
      return NextResponse.json({ error: 'Data ban tidak ditemukan.' }, { status: 404 })
    }

    const now = new Date()
    await Ban.updateOne(
      { _id: ban._id },
      { $set: { isActive: false, revokedAt: now, updatedAt: now } },
    )

    if (ban.isActive) {
      const stillActive = await Ban.countDocuments({ uid: ban.uid, isActive: true })
      if (stillActive === 0) {
        await setUserStatus(ban.uid, { status: 'active' }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/admin/bans/[id] gagal:', e)
    return serverError('Gagal mencabut ban.')
  }
}
