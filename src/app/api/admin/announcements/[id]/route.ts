import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { announcementsCol } from '@/models/Announcement'
import { toPlain } from '@/lib/serialize'

const TYPES = ['info', 'warning', 'success', 'error']
const AUDIENCES = ['all', 'free', 'premium']

function validId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

/** Detail satu pengumuman. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const _id = validId(params.id)
    if (!_id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })
    const A = await announcementsCol()
    const doc = await A.findOne({ _id })
    if (!doc) return NextResponse.json({ error: 'Pengumuman tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ announcement: toPlain(doc) })
  } catch (e) {
    console.error('GET /api/admin/announcements/[id] gagal:', e)
    return serverError('Gagal memuat pengumuman.')
  }
}

/** Ubah / tayangkan / hentikan pengumuman. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const _id = validId(params.id)
    if (!_id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })

    const A = await announcementsCol()
    const existing = await A.findOne({ _id })
    if (!existing) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const setDoc: Record<string, unknown> = { updatedAt: new Date() }

    if (body?.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return NextResponse.json({ error: 'Judul wajib diisi.' }, { status: 400 })
      setDoc.title = title
    }
    if (body?.content !== undefined) {
      const content = String(body.content).trim()
      if (!content) return NextResponse.json({ error: 'Isi wajib diisi.' }, { status: 400 })
      setDoc.content = content
    }
    if (body?.type !== undefined) {
      if (!TYPES.includes(body.type)) {
        return NextResponse.json({ error: 'Tipe tidak valid.' }, { status: 400 })
      }
      setDoc.type = body.type
    }
    if (body?.targetAudience !== undefined) {
      if (!AUDIENCES.includes(body.targetAudience)) {
        return NextResponse.json({ error: 'Target audiens tidak valid.' }, { status: 400 })
      }
      setDoc.targetAudience = body.targetAudience
    }
    if (body?.isPublished !== undefined) {
      const pub = body.isPublished === true
      setDoc.isPublished = pub
      if (pub && !existing.publishedAt) setDoc.publishedAt = new Date()
    }
    if (body?.expiresAt !== undefined) {
      if (body.expiresAt) {
        const exp = new Date(body.expiresAt)
        if (Number.isNaN(+exp)) {
          return NextResponse.json({ error: 'Tanggal kedaluwarsa tidak valid.' }, { status: 400 })
        }
        setDoc.expiresAt = exp
      } else {
        setDoc.expiresAt = null
      }
    }

    await A.updateOne({ _id }, { $set: setDoc })
    const updated = await A.findOne({ _id })
    return NextResponse.json({ ok: true, announcement: toPlain(updated) })
  } catch (e) {
    console.error('PUT /api/admin/announcements/[id] gagal:', e)
    return serverError('Gagal mengubah pengumuman.')
  }
}

/** Hapus pengumuman. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const _id = validId(params.id)
    if (!_id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })
    const A = await announcementsCol()
    const result = await A.deleteOne({ _id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/admin/announcements/[id] gagal:', e)
    return serverError('Gagal menghapus pengumuman.')
  }
}
