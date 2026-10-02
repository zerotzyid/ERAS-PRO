import { NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/session'

/** Profil admin yang sedang login (untuk header dashboard). */
export async function GET() {
  const session = await getStaffSession()
  if (!session) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
  }
  return NextResponse.json({ user: session })
}
