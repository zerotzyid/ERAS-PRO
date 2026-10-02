import type { Collection, ObjectId } from 'mongodb'
import { connectAppDB } from '@/lib/db'

/**
 * Rilisan update aplikasi Android. Koleksi: `app_updates`.
 * Aplikasi membandingkan `versionCode` dengan BuildConfig.VERSION_CODE.
 */
export interface AppUpdateDoc {
  _id?: ObjectId
  versionCode: number
  versionName: string
  apkUrl: string
  changelog?: string
  mandatory: boolean
  isPublished: boolean
  publishedAt?: Date
  createdBy: string
  createdAt?: Date
  updatedAt?: Date
}

export async function appUpdatesCol(): Promise<Collection<AppUpdateDoc>> {
  const db = await connectAppDB()
  const col = db.collection<AppUpdateDoc>('app_updates')
  await Promise.all([
    col.createIndex({ versionCode: -1 }).catch(() => {}),
    col.createIndex({ isPublished: 1, versionCode: -1 }).catch(() => {}),
  ])
  return col
}
