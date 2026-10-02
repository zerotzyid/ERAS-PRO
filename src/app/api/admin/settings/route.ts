import { NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { connectAdminDB, connectAppDB } from '@/lib/db'

function maskUri(uri: string): string {
  try {
    // sembunyikan password: mongodb+srv://user:***@host/...
    return uri.replace(/\/\/([^:/?#]+):([^@/?#]+)@/, '//$1:***@')
  } catch {
    return '(tidak terbaca)'
  }
}

/** Info koneksi database + versi (untuk halaman Pengaturan). */
export async function GET() {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const adminDbName = process.env.ADMIN_DB_NAME || 'rinova_admin'
    const appDbName = process.env.APP_DB_NAME || 'rinova'
    const rawUri = process.env.ADMIN_MONGODB_URI || process.env.MONGODB_URI || ''
    const rawAppUri = process.env.APP_MONGODB_URI || process.env.MONGODB_URI || ''

    const [adminDb, appDb] = await Promise.all([connectAdminDB(), connectAppDB()])
    const [adminPing, appPing] = await Promise.all([
      adminDb.command({ ping: 1 }).then(
        () => true,
        () => false,
      ),
      appDb.command({ ping: 1 }).then(
        () => true,
        () => false,
      ),
    ])

    return NextResponse.json({
      adminDb: { name: adminDbName, uri: maskUri(rawUri), connected: adminPing },
      appDb: { name: appDbName, uri: maskUri(rawAppUri), connected: appPing },
      publicApi: '/api/public/announcements',
      publicUpdateApi: '/api/public/app-update',
      agent: {
        endpoint: '/agent',
        // Kunci hanya ditampilkan ke role admin (bukan moderator).
        apiKey: staff.role === 'admin' ? process.env.AGENT_API_KEY || '' : undefined,
        configured: !!(process.env.AGENT_API_KEY || ''),
      },
      version: '1.0.0',
    })
  } catch (e) {
    console.error('GET /api/admin/settings gagal:', e)
    return serverError('Gagal memuat info pengaturan.')
  }
}
