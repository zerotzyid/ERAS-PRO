import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { adminsCol } from '@/models/Admin'

/** Ganti password sendiri. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const oldPassword = String(body?.oldPassword ?? '')
    const newPassword = String(body?.newPassword ?? '')

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 })
    }

    const Admin = await adminsCol()
    const admin = await Admin.findOne({ _id: new ObjectId(staff.id) })
    if (!admin) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 })
    }

    const ok = await bcrypt.compare(oldPassword, admin.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Password lama salah.' }, { status: 400 })
    }

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { passwordHash: await bcrypt.hash(newPassword, 12), updatedAt: new Date() } },
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/admin/password gagal:', e)
    return serverError('Gagal mengganti password.')
  }
}
