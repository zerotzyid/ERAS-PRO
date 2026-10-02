import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { adminsCol } from '@/models/Admin'
import { toPlain } from '@/lib/serialize'

/** Daftar akun admin panel (tanpa password hash). */
export async function GET() {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const Admin = await adminsCol()
    const docs = await Admin.find(
      {},
      { projection: { email: 1, name: 1, role: 1, createdAt: 1 } },
    )
      .sort({ createdAt: 1 })
      .toArray()
    return NextResponse.json({ admins: toPlain(docs) })
  } catch (e) {
    console.error('GET /api/admin/admins gagal:', e)
    return serverError('Gagal memuat daftar admin.')
  }
}

/** Tambah akun admin/moderator (khusus role admin). */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()
  if (staff.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang bisa menambah akun.' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? '').toLowerCase().trim()
    const name = String(body?.name ?? '').trim()
    const password = String(body?.password ?? '')
    const role = body?.role === 'moderator' ? 'moderator' : 'admin'

    if (!email || !name) {
      return NextResponse.json({ error: 'Email dan nama wajib diisi.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 })
    }

    const Admin = await adminsCol()
    const exists = await Admin.findOne({ email }, { projection: { _id: 1 } })
    if (exists) {
      return NextResponse.json({ error: 'Email sudah terdaftar.' }, { status: 400 })
    }

    const now = new Date()
    await Admin.insertOne({
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      createdAt: now,
      updatedAt: now,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    console.error('POST /api/admin/admins gagal:', e)
    return serverError('Gagal menambah akun.')
  }
}
