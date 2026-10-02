import { NextRequest, NextResponse } from 'next/server'
import { appUpdatesCol } from '@/models/AppUpdate'
import { toPlain } from '@/lib/serialize'

/**
 * Endpoint PUBLIK (tanpa login) untuk cek update aplikasi.
 * GET /api/public/app-update?versionCode=1
 *
 * Aplikasi membandingkan versionCode terpasang dengan rilisan tayang terbaru.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const current = parseInt(searchParams.get('versionCode') || '0', 10) || 0

    const U = await appUpdatesCol()
    const latest = await U.find({ isPublished: true })
      .sort({ versionCode: -1 })
      .limit(1)
      .toArray()
    const doc = latest[0]

    if (!doc || doc.versionCode <= current) {
      return NextResponse.json(
        { updateAvailable: false },
        { headers: { 'Cache-Control': 'public, max-age=300' } },
      )
    }

    const plain = toPlain(doc) as Record<string, unknown>
    return NextResponse.json(
      {
        updateAvailable: true,
        mandatory: !!plain.mandatory,
        versionCode: plain.versionCode,
        versionName: plain.versionName,
        apkUrl: plain.apkUrl,
        changelog: plain.changelog ?? '',
      },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    )
  } catch (e) {
    console.error('GET /api/public/app-update gagal:', e)
    return NextResponse.json({ error: 'Gagal memeriksa update.' }, { status: 500 })
  }
}
