import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { adminsCol } from '@/models/Admin'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? '').toLowerCase().trim()
    const password = String(body?.password ?? '')
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 })
    }

    const Admin = await adminsCol()
    const admin = await Admin.findOne({ email })
    if (!admin) {
      return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, admin.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 })
    }

    const token = await signSession({
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
      role: admin.role,
    })

    const res = NextResponse.json({
      ok: true,
      user: { email: admin.email, name: admin.name, role: admin.role },
    })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })
    return res
  } catch (e) {
    console.error('POST /api/auth/login gagal:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
