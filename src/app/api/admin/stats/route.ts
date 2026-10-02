import { NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { appUsersCol } from '@/models/AppUser'
import { bansCol } from '@/models/Ban'
import { announcementsCol } from '@/models/Announcement'
import { badgesCol } from '@/models/Badge'
import { joinedFromObjectId, toPlain } from '@/lib/serialize'

/** Statistik ringkas untuk Beranda — semua dari database aplikasi (real-time). */
export async function GET() {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const AppUser = await appUsersCol()
    const Ban = await bansCol()
    const Announcement = await announcementsCol()
    const Badge = await badgesCol()

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    const [total, premium, banned, suspended, active7d, activeBans, published, activeBadges] =
      await Promise.all([
        AppUser.countDocuments({}),
        AppUser.countDocuments({ isPremium: true }),
        AppUser.countDocuments({ status: 'banned' }),
        AppUser.countDocuments({ status: 'suspended' }),
        AppUser.countDocuments({ updatedAt: { $gte: weekAgo } }),
        Ban.countDocuments({ isActive: true }),
        Announcement.countDocuments({ isPublished: true }),
        Badge.countDocuments({ isActive: true }),
      ])

    const recentUsersRaw = await AppUser.find(
      {},
      { projection: { uid: 1, email: 1, name: 1, username: 1, isPremium: 1, status: 1 } },
    )
      .sort({ _id: -1 })
      .limit(5)
      .toArray()
    const recentUsers = toPlain(recentUsersRaw).map((u: Record<string, unknown>) => ({
      ...u,
      joinedAt: joinedFromObjectId((u as { _id?: unknown })._id),
    }))

    const recentBansRaw = await Ban.find({}).sort({ createdAt: -1 }).limit(5).toArray()

    return NextResponse.json({
      stats: { total, premium, banned, suspended, active7d, activeBans, published, activeBadges },
      recentUsers,
      recentBans: toPlain(recentBansRaw),
    })
  } catch (e) {
    console.error('GET /api/admin/stats gagal:', e)
    return serverError('Gagal memuat statistik. Periksa koneksi MongoDB Atlas.')
  }
}
