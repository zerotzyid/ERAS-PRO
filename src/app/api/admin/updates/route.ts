import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { appUpdatesCol } from '@/models/AppUpdate'
import { toPlain } from '@/lib/serialize'

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Daftar semua rilisan + info rilisan tayang terbaru. */
export async function GET() {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const U = await appUpdatesCol()
    const [docs, latest] = await Promise.all([
      U.find({}).sort({ versionCode: -1 }).toArray(),
      U.find({ isPublished: true }).sort({ versionCode: -1 }).limit(1).toArray(),
    ])
    return NextResponse.json({
      updates: toPlain(docs),
      latestPublished: toPlain(latest[0] ?? null),
    })
  } catch (e) {
    console.error('GET /api/admin/updates gagal:', e)
    return serverError('Gagal memuat data update.')
  }
}

/** Terbitkan rilisan baru. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const versionCode = Number(body?.versionCode)
    const versionName = String(body?.versionName ?? '').trim()
    const apkUrl = String(body?.apkUrl ?? '').trim()
    const changelog = String(body?.changelog ?? '').trim()
    const mandatory = body?.mandatory === true
    const isPublished = body?.isPublished === true

    if (!Number.isInteger(versionCode) || versionCode < 1) {
      return NextResponse.json({ error: 'Version code harus angka bulat ≥ 1.' }, { status: 400 })
    }
    if (!versionName) {
      return NextResponse.json({ error: 'Nama versi wajib diisi (cth. 1.1).' }, { status: 400 })
    }
    if (!isValidUrl(apkUrl)) {
      return NextResponse.json({ error: 'Link APK tidak valid (harus http/https).' }, { status: 400 })
    }

    const U = await appUpdatesCol()
    const exists = await U.findOne({ versionCode }, { projection: { _id: 1 } })
    if (exists) {
      return NextResponse.json(
        { error: `Version code ${versionCode} sudah dipakai rilisan lain.` },
        { status: 400 },
      )
    }

    const now = new Date()
    const result = await U.insertOne({
      versionCode,
      versionName,
      apkUrl,
      ...(changelog ? { changelog } : {}),
      mandatory,
      isPublished,
      ...(isPublished ? { publishedAt: now } : {}),
      createdBy: staff.email,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ ok: true, id: String(result.insertedId) }, { status: 201 })
  } catch (e) {
    console.error('POST /api/admin/updates gagal:', e)
    return serverError('Gagal menerbitkan update.')
  }
}
