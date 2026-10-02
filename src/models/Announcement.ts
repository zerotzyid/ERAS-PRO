import type { Collection, ObjectId } from 'mongodb'
import { connectAppDB } from '@/lib/db'

/** Pengumuman untuk aplikasi. Koleksi: `announcements`. */
export type AnnouncementType = 'info' | 'warning' | 'success' | 'error'
export type AnnouncementAudience = 'all' | 'free' | 'premium'

export interface AnnouncementDoc {
  _id?: ObjectId
  title: string
  content: string
  type: AnnouncementType
  targetAudience: AnnouncementAudience
  isPublished: boolean
  publishedAt?: Date
  expiresAt?: Date
  createdBy: string
  createdAt?: Date
  updatedAt?: Date
}

export async function announcementsCol(): Promise<Collection<AnnouncementDoc>> {
  const db = await connectAppDB()
  const col = db.collection<AnnouncementDoc>('announcements')
  await Promise.all([
    col.createIndex({ isPublished: 1, publishedAt: -1 }).catch(() => {}),
    col.createIndex({ targetAudience: 1, isPublished: 1 }).catch(() => {}),
  ])
  return col
}
