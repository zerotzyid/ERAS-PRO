import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { adminsCol } from '@/models/Admin'

/** Hapus akun admin/moderator (khusus role admin, tidak bisa hapus diri sendiri). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()
  if (staff.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang bisa menghapus akun.' }, { status: 403 })
  }

  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })
    }
    const _id = new ObjectId(params.id)
    if (String(_id) === staff.id) {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri.' }, { status: 400 })
    }

    const Admin = await adminsCol()
    const target = await Admin.findOne({ _id }, { projection: { role: 1 } })
    if (!target) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 })
    }
    if (target.role === 'admin') {
      const adminCount = await Admin.countDocuments({ role: 'admin' })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Tidak bisa menghapus satu-satunya admin.' },
          { status: 400 },
        )
      }
    }

    await Admin.deleteOne({ _id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/admin/admins/[id] gagal:', e)
    return serverError('Gagal menghapus akun.')
  }
}
