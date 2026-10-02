import type { Collection, ObjectId } from 'mongodb'
import { connectAppDB } from '@/lib/db'

/** Riwayat ban/suspend user aplikasi. Koleksi: `bans`. */
export interface BanDoc {
  _id?: ObjectId
  uid: string
  userEmail?: string
  userName?: string
  type: 'ban' | 'suspend'
  reason: string
  expiresAt?: Date
  createdBy: string
  isActive: boolean
  revokedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

export async function bansCol(): Promise<Collection<BanDoc>> {
  const db = await connectAppDB()
  const col = db.collection<BanDoc>('bans')
  await Promise.all([
    col.createIndex({ uid: 1, isActive: 1 }).catch(() => {}),
    col.createIndex({ isActive: 1, createdAt: -1 }).catch(() => {}),
  ])
  return col
}
