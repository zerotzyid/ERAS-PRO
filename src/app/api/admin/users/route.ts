import { NextRequest, NextResponse } from 'next/server'
import type { Filter } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { appUsersCol, type AppUserDoc } from '@/models/AppUser'
import { joinedFromObjectId, toPlain } from '@/lib/serialize'

const PROJECTION = {
  uid: 1,
  email: 1,
  name: 1,
  username: 1,
  photo: 1,
  isPremium: 1,
  premiumExpiresAt: 1,
  status: 1,
  banReason: 1,
  bannedAt: 1,
  banExpiresAt: 1,
  badgeText: 1,
  badgeColor: 1,
  commentCount: 1,
  level: 1,
  rank: 1,
  totalAnime: 1,
  totalEp: 1,
  updatedAt: 1,
}

/** Daftar user aplikasi + pencarian + filter + pagination. */
export async function GET(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status') || ''
    const premium = searchParams.get('premium') || ''

    const filter: Filter<AppUserDoc> = {}
    if (search) {
      const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [{ email: rx }, { name: rx }, { username: rx }, { uid: rx }] as never
    }
    if (status === 'active') {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? (filter.$and as never[]) : []),
        { $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }] },
      ] as never
    } else if (status === 'suspended' || status === 'banned') {
      filter.status = status
    }
    if (premium === 'true') filter.isPremium = true
    else if (premium === 'false') filter.isPremium = { $ne: true }

    const Users = await appUsersCol()
    const [docs, total] = await Promise.all([
      Users.find(filter, { projection: PROJECTION })
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      Users.countDocuments(filter),
    ])

    const users = toPlain(docs).map((u: Record<string, unknown>) => ({
      ...u,
      status: (u.status as string) || 'active',
      joinedAt: joinedFromObjectId((u as { _id?: unknown })._id),
    }))

    return NextResponse.json({
      users,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (e) {
    console.error('GET /api/admin/users gagal:', e)
    return serverError('Gagal memuat daftar pengguna.')
  }
}
