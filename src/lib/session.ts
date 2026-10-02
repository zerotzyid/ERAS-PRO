import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

/**
 * Sesi admin ringan berbasis JWT (cookie httpOnly).
 * - Ringan & edge-safe (jose memakai WebCrypto) → cocok untuk Vercel free tier.
 * - Tidak ada dependency auth yang berat; role tersimpan di dalam token.
 */

export const SESSION_COOKIE = 'rinova_session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 hari (detik)

export type StaffRole = 'admin' | 'moderator'

export type StaffSession = {
  id: string
  email: string
  name: string
  role: StaffRole
}

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''
  if (!s) {
    throw new Error('AUTH_SECRET belum diisi di environment.')
  }
  return new TextEncoder().encode(s)
}

export async function signSession(payload: StaffSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const role = payload.role as string
    if (typeof payload.id !== 'string' || (role !== 'admin' && role !== 'moderator')) {
      return null
    }
    return {
      id: payload.id,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role,
    }
  } catch {
    return null
  }
}

/** Baca sesi dari cookie (untuk API routes & server components). */
export async function getStaffSession(): Promise<StaffSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySession(token)
}
