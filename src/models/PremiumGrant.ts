import type { Collection, ObjectId } from 'mongodb'
import { connectAppDB } from '@/lib/db'

/** Riwayat pemberian/pencabutan premium. Koleksi: `premium_grants`. */
export interface PremiumGrantDoc {
  _id?: ObjectId
  uid: string
  userEmail?: string
  userName?: string
  action: 'grant' | 'revoke'
  plan?: 'monthly' | 'yearly' | 'lifetime'
  expiresAt?: Date
  note?: string
  createdBy: string
  createdAt?: Date
  updatedAt?: Date
}

export async function premiumGrantsCol(): Promise<Collection<PremiumGrantDoc>> {
  const db = await connectAppDB()
  const col = db.collection<PremiumGrantDoc>('premium_grants')
  await Promise.all([
    col.createIndex({ uid: 1, createdAt: -1 }).catch(() => {}),
    col.createIndex({ createdAt: -1 }).catch(() => {}),
  ])
  return col
}
