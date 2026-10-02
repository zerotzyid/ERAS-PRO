import type { Collection, ObjectId } from 'mongodb'
import { connectAppDB } from '@/lib/db'

/**
 * Profil user APLIKASI Android (koleksi `users` di database `rinova`).
 *
 * Web HANYA menulis via updateOne/$set dan SELALU menyertakan
 * `updatedAt: Date.now()` agar konsisten dengan pola last-write-wins aplikasi.
 * Field yang tidak dikenal aplikasi dibiarkan apa adanya (tidak pernah di-unset).
 */
export type AppUserStatus = 'active' | 'suspended' | 'banned'

export interface AppUserDoc {
  _id?: ObjectId
  uid: string
  email?: string
  name?: string
  username?: string
  photo?: string
  isPremium?: boolean
  premiumExpiresAt?: Date
  status?: AppUserStatus
  banReason?: string
  bannedAt?: Date
  banExpiresAt?: Date
  badgeText?: string
  badgeColor?: unknown
  isAdmin?: boolean
  commentCount?: unknown
  level?: number
  rank?: string
  totalAnime?: number
  totalEp?: number
  watchCountSinceLastAd?: number
  updatedAt?: unknown
}

export async function appUsersCol(): Promise<Collection<AppUserDoc>> {
  const db = await connectAppDB()
  const col = db.collection<AppUserDoc>('users')
  await Promise.all([
    col.createIndex({ uid: 1 }, { unique: true }).catch(() => {}),
    col.createIndex({ email: 1 }).catch(() => {}),
    col.createIndex({ status: 1 }).catch(() => {}),
    col.createIndex({ isPremium: 1 }).catch(() => {}),
  ])
  return col
}
