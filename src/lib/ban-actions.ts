import { ObjectId } from 'mongodb'
import { appUsersCol } from '@/models/AppUser'
import { bansCol } from '@/models/Ban'
import { setUserStatus, UserNotFoundError } from './app-writes'

/**
 * Logika ban/suspend dipakai bersama oleh panel admin & endpoint /agent.
 * Selalu meniru perilaku yang sama: cek ban aktif ganda, tulis status user,
 * catat riwayat, pulihkan bila tak ada ban aktif lain.
 */
export class BanActionError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export type BanType = 'ban' | 'suspend'

export async function createBanRecord(opts: {
  uid: string
  type: BanType
  reason: string
  expiresAt?: Date | null
  by: string
}): Promise<{ id: string }> {
  const uid = opts.uid.trim()
  const reason = opts.reason.trim()
  if (!uid) throw new BanActionError('UID user wajib diisi.')
  if (opts.type !== 'ban' && opts.type !== 'suspend') {
    throw new BanActionError('Jenis tidak valid (ban/suspend).')
  }
  if (!reason) throw new BanActionError('Alasan wajib diisi.')
  if (opts.type === 'suspend' && opts.expiresAt && Number.isNaN(+opts.expiresAt)) {
    throw new BanActionError('Tanggal kedaluwarsa tidak valid.')
  }

  const Users = await appUsersCol()
  const user = await Users.findOne(
    { uid },
    { projection: { email: 1, name: 1, username: 1 } },
  )
  if (!user) throw new UserNotFoundError(uid)

  const Ban = await bansCol()
  const existing = await Ban.findOne({ uid, isActive: true })
  if (existing) {
    throw new BanActionError(
      'User ini sudah memiliki ban/suspend aktif. Cabut dulu sebelum membuat yang baru.',
    )
  }

  await setUserStatus(uid, {
    status: opts.type === 'ban' ? 'banned' : 'suspended',
    reason,
    expiresAt: opts.type === 'suspend' ? (opts.expiresAt ?? null) : null,
  })

  const now = new Date()
  const result = await Ban.insertOne({
    uid,
    userEmail: user.email,
    userName: user.name ?? user.username,
    type: opts.type,
    reason,
    ...(opts.type === 'suspend' && opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
    createdBy: opts.by,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
  return { id: String(result.insertedId) }
}

export async function revokeBanRecord(id: string): Promise<{ uid: string }> {
  if (!ObjectId.isValid(id)) throw new BanActionError('ID tidak valid.')
  const Ban = await bansCol()
  const ban = await Ban.findOne({ _id: new ObjectId(id) })
  if (!ban) throw new BanActionError('Data ban tidak ditemukan.', 404)

  const now = new Date()
  await Ban.updateOne(
    { _id: ban._id },
    { $set: { isActive: false, revokedAt: now, updatedAt: now } },
  )

  if (ban.isActive) {
    const stillActive = await Ban.countDocuments({ uid: ban.uid, isActive: true })
    if (stillActive === 0) {
      await setUserStatus(ban.uid, { status: 'active' }).catch(() => {})
    }
  }
  return { uid: ban.uid }
}
