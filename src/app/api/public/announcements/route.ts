import { NextRequest, NextResponse } from 'next/server'
import type { Filter } from 'mongodb'
import { announcementsCol, type AnnouncementAudience, type AnnouncementDoc } from '@/models/Announcement'
import { toPlain } from '@/lib/serialize'

/**
 * Endpoint PUBLIK (tanpa login) untuk aplikasi Android.
 * GET /api/public/announcements?isPremium=true&limit=5
 *
 * Hanya mengembalikan pengumuman yang tayang + belum kedaluwarsa,
 * difilter berdasar audiens. Tanpa data sensitif (tanpa createdBy).
 */
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const isPremium = searchParams.get('isPremium') === 'true'
    const limit = Math.min(
      20,
      Math.max(1, parseInt(searchParams.get('limit') || '5', 10) || 5),
    )

    const now = new Date()
    const audiences: AnnouncementAudience[] = isPremium ? ['all', 'premium'] : ['all', 'free']

    const A = await announcementsCol()
    const filter: Filter<AnnouncementDoc> = {
      isPublished: true,
      targetAudience: { $in: audiences },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    }
    const docs = await A.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .toArray()

    const items = toPlain(docs).map((d: Record<string, unknown>) => ({
      id: String(d._id),
      title: d.title,
      content: d.content,
      type: d.type,
      publishedAt: d.publishedAt ?? d.createdAt,
      expiresAt: d.expiresAt ?? null,
    }))

    return NextResponse.json(
      { announcements: items },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    )
  } catch (e) {
    console.error('GET /api/public/announcements gagal:', e)
    return NextResponse.json({ error: 'Gagal memuat pengumuman.' }, { status: 500 })
  }
}
