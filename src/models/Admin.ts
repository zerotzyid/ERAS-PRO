import type { Collection, ObjectId } from 'mongodb'
import { connectAdminDB } from '@/lib/db'

export type AdminRole = 'admin' | 'moderator'

export interface AdminDoc {
  _id?: ObjectId
  email: string
  name: string
  passwordHash: string
  role: AdminRole
  createdAt?: Date
  updatedAt?: Date
}

export async function adminsCol(): Promise<Collection<AdminDoc>> {
  const db = await connectAdminDB()
  const col = db.collection<AdminDoc>('admins')
  await col.createIndex({ email: 1 }, { unique: true }).catch(() => {})
  return col
}
