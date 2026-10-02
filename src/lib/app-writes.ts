import { appUsersCol } from '@/models/AppUser'
import { premiumGrantsCol } from '@/models/PremiumGrant'
import { hexToArgbLong } from './badge-color'

/**
 * Operasi tulis ke dokumen user APLIKASI (koleksi `users`, db `rinova`).
 * Dipakai bersama oleh API users / bans / premium / badges.
 * Selalu menyertakan `updatedAt: Date.now()` (last-write-wins milik aplikasi).
 */

export class UserNotFoundError extends Error {
  constructor(uid: string) {
    super(`User aplikasi tidak ditemukan: ${uid}`)
  }
}

async function mustFindUser(uid: string) {
  const Users = await appUsersCol()
  const user = await Users.findOne({ uid })
  if (!user) throw new UserNotFoundError(uid)
  return { Users, user }
}

export async function setUserPremium(
  uid: string,
  opts: {
    isPremium: boolean
    plan?: 'monthly' | 'yearly' | 'lifetime'
    expiresAt?: Date | null
    note?: string
    by: string
  },
) {
  const { Users, user } = await mustFindUser(uid)
  const now = Date.now()

  if (opts.isPremium) {
    const setDoc: Record<string, unknown> = { isPremium: true, updatedAt: now }
    if (opts.expiresAt) setDoc.premiumExpiresAt = opts.expiresAt
    else setDoc.premiumExpiresAt = null
    await Users.updateOne({ uid }, { $set: setDoc })
  } else {
    await Users.updateOne(
      { uid },
      { $set: { isPremium: false, updatedAt: now }, $unset: { premiumExpiresAt: '' } },
    )
  }

  const Grants = await premiumGrantsCol()
  await Grants.insertOne({
    uid,
    userEmail: user.email,
    userName: user.name ?? user.username,
    action: opts.isPremium ? 'grant' : 'revoke',
    plan: opts.isPremium ? opts.plan : undefined,
    expiresAt: opts.isPremium ? (opts.expiresAt ?? undefined) : undefined,
    note: opts.note,
    createdBy: opts.by,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

export async function setUserStatus(
  uid: string,
  opts: {
    status: 'active' | 'suspended' | 'banned'
    reason?: string
    expiresAt?: Date | null
  },
) {
  const { Users } = await mustFindUser(uid)
  const now = Date.now()

  if (opts.status === 'active') {
    await Users.updateOne(
      { uid },
      {
        $set: { status: 'active', updatedAt: now },
        $unset: { banReason: '', bannedAt: '', banExpiresAt: '' },
      },
    )
  } else {
    const setDoc: Record<string, unknown> = {
      status: opts.status,
      banReason: opts.reason ?? '',
      bannedAt: new Date(),
      updatedAt: now,
    }
    // banExpiresAt ditulis agar aplikasi bisa melepas suspend kedaluwarsa sendiri.
    if (opts.status === 'suspended' && opts.expiresAt) {
      setDoc.banExpiresAt = opts.expiresAt
    } else {
      await Users.updateOne({ uid }, { $unset: { banExpiresAt: '' } })
    }
    await Users.updateOne({ uid }, { $set: setDoc })
  }
}

export async function setUserBadge(
  uid: string,
  badge: { name: string; colorHex: string } | null,
) {
  const { Users } = await mustFindUser(uid)
  const now = Date.now()

  if (!badge) {
    await Users.updateOne(
      { uid },
      { $unset: { badgeText: '', badgeColor: '' }, $set: { updatedAt: now } },
    )
    return
  }

  // WAJIB Long (Int64) — Number JS biasa tersimpan sebagai Double
  // dan gagal dibaca doc.getLong() di aplikasi Android.
  const colorLong = hexToArgbLong(badge.colorHex)
  await Users.updateOne(
    { uid },
    { $set: { badgeText: badge.name, badgeColor: colorLong, updatedAt: now } },
  )
}

export async function updateUserProfile(uid: string, patch: { name?: string; username?: string }) {
  const { Users } = await mustFindUser(uid)
  const setDoc: Record<string, unknown> = { updatedAt: Date.now() }
  if (patch.name !== undefined) setDoc.name = patch.name
  if (patch.username !== undefined) setDoc.username = patch.username
  await Users.updateOne({ uid }, { $set: setDoc })
}
