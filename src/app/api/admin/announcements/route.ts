import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { announcementsCol } from '@/models/Announcement'
import { toPlain } from '@/lib/serialize'

const TYPES = ['info', 'warning', 'success', 'error']
const AUDIENCES = ['all', 'free', 'premium']

/** Turunkan otomatis pengumuman yang sudah kedaluwarsa (lazy, tanpa cron). */
async function sweepExpired() {
  const A = await announcementsCol()
  await A.updateMany(
    { expiresAt: { $exists: true, $not: { $type: 'date' } } },
    { $unset: { expiresAt: '' } },
  ).catch(() => {})
  const now = new Date()
  await A.updateMany(
    { isPublished: true, expiresAt: { $type: 'date', $lte: now } },
    { $set: { isPublished: false, updatedAt: now } },
  ).catch(() => {})
}

/** Daftar pengumuman + filter + pagination. */
export async function GET(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    await sweepExpired()

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const published = searchParams.get('published') || ''

    const filter: Record<string, unknown> = {}
    if (published === 'true') filter.isPublished = true
    else if (published === 'false') filter.isPublished = false

    const A = await announcementsCol()
    const [docs, total] = await Promise.all([
      A.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      A.countDocuments(filter),
    ])

    return NextResponse.json({
      announcements: toPlain(docs),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (e) {
    console.error('GET /api/admin/announcements gagal:', e)
    return serverError('Gagal memuat pengumuman.')
  }
}

/** Buat pengumuman baru. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const title = String(body?.title ?? '').trim()
    const content = String(body?.content ?? '').trim()
    const type = body?.type || 'info'
    const targetAudience = body?.targetAudience || 'all'
    const isPublished = body?.isPublished === true
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null

    if (!title) return NextResponse.json({ error: 'Judul wajib diisi.' }, { status: 400 })
    if (!content) return NextResponse.json({ error: 'Isi wajib diisi.' }, { status: 400 })
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipe tidak valid.' }, { status: 400 })
    }
    if (!AUDIENCES.includes(targetAudience)) {
      return NextResponse.json({ error: 'Target audiens tidak valid.' }, { status: 400 })
    }
    if (expiresAt && Number.isNaN(+expiresAt)) {
      return NextResponse.json({ error: 'Tanggal kedaluwarsa tidak valid.' }, { status: 400 })
    }

    const now = new Date()
    const A = await announcementsCol()
    const result = await A.insertOne({
      title,
      content,
      type,
      targetAudience,
      isPublished,
      ...(isPublished ? { publishedAt: now } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      createdBy: staff.email,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ ok: true, id: String(result.insertedId) }, { status: 201 })
  } catch (e) {
    console.error('POST /api/admin/announcements gagal:', e)
    return serverError('Gagal membuat pengumuman.')
  }
}
