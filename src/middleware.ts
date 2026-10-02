import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE } from '@/lib/session'

// Middleware berjalan di Edge Runtime — hanya memakai `jose` (WebCrypto),
// TANPA mongoose/bcrypt agar ringan & aman di Vercel free tier.

async function readRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '',
    )
    const { payload } = await jwtVerify(token, secret)
    const role = payload.role as string
    return role === 'admin' || role === 'moderator' ? role : null
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Endpoint login/logout/me & API publik aplikasi: selalu boleh.
  if (pathname.startsWith('/api/auth')) return NextResponse.next()
  if (pathname.startsWith('/api/public')) return NextResponse.next()

  const role = await readRole(req)
  const loggedIn = role !== null

  // Halaman login: yang sudah login dilempar ke dashboard.
  if (pathname.startsWith('/auth/')) {
    if (loggedIn) return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.next()
  }

  const isAdminArea =
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/admin')

  if (isAdminArea && !loggedIn) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Tidak diizinkan. Silakan login ulang sebagai admin.' },
        { status: 401 },
      )
    }
    const url = new URL('/auth/signin', req.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
}
