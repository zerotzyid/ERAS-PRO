import { NextResponse } from 'next/server'
import { getStaffSession, type StaffSession } from '@/lib/session'

/** Wajib login sebagai admin/moderator. Kembalikan null bila tidak sah. */
export async function requireStaff(): Promise<StaffSession | null> {
  return getStaffSession()
}

export function unauthorized() {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Silakan login ulang sebagai admin.' },
    { status: 401 },
  )
}

export function serverError(message = 'Terjadi kesalahan server.') {
  return NextResponse.json({ error: message }, { status: 500 })
}
