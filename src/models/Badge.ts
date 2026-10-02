import type { Collection, ObjectId } from 'mongodb'
import { connectAppDB } from '@/lib/db'

/**
 * Definisi badge/tag. Koleksi: `badges`.
 * Assign ke user = tulis `badgeText` (nama) + `badgeColor` (ARGB Long) ke dokumen user.
 */
export type BadgeType = 'role' | 'achievement' | 'special' | 'verification'

export interface BadgeDoc {
  _id?: ObjectId
  name: string
  description?: string
  color: string
  type: BadgeType
  isActive: boolean
  createdBy: string
  createdAt?: Date
  updatedAt?: Date
}

export async function badgesCol(): Promise<Collection<BadgeDoc>> {
  const db = await connectAppDB()
  const col = db.collection<BadgeDoc>('badges')
  await col.createIndex({ name: 1 }, { unique: true }).catch(() => {})
  return col
}
