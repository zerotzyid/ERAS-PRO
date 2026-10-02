import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { appUpdatesCol } from '@/models/AppUpdate'
import { toPlain } from '@/lib/serialize'

function validId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Ubah / tayangkan / tarik rilisan. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const _id = validId(params.id)
    if (!_id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })

    const U = await appUpdatesCol()
    const existing = await U.findOne({ _id })
    if (!existing) {
      return NextResponse.json({ error: 'Rilisan tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const setDoc: Record<string, unknown> = { updatedAt: new Date() }

    if (body?.versionName !== undefined) {
      const v = String(body.versionName).trim()
      if (!v) return NextResponse.json({ error: 'Nama versi wajib diisi.' }, { status: 400 })
      setDoc.versionName = v
    }
    if (body?.apkUrl !== undefined) {
      const url = String(body.apkUrl).trim()
      if (!isValidUrl(url)) {
        return NextResponse.json({ error: 'Link APK tidak valid.' }, { status: 400 })
      }
      setDoc.apkUrl = url
    }
    if (body?.changelog !== undefined) setDoc.changelog = String(body.changelog)
    if (body?.mandatory !== undefined) setDoc.mandatory = body.mandatory === true
    if (body?.isPublished !== undefined) {
      const pub = body.isPublished === true
      setDoc.isPublished = pub
      if (pub && !existing.publishedAt) setDoc.publishedAt = new Date()
    }
    // Version code tidak bisa diubah (dipakai aplikasi sebagai pembanding).

    await U.updateOne({ _id }, { $set: setDoc })
    const updated = await U.findOne({ _id })
    return NextResponse.json({ ok: true, update: toPlain(updated) })
  } catch (e) {
    console.error('PUT /api/admin/updates/[id] gagal:', e)
    return serverError('Gagal mengubah rilisan.')
  }
}

/** Hapus rilisan. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const _id = validId(params.id)
    if (!_id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 })
    const U = await appUpdatesCol()
    const result = await U.deleteOne({ _id })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Rilisan tidak ditemukan.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/admin/updates/[id] gagal:', e)
    return serverError('Gagal menghapus rilisan.')
  }
}
