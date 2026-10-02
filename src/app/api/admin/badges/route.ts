import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { badgesCol } from '@/models/Badge'
import { appUsersCol } from '@/models/AppUser'
import { toPlain } from '@/lib/serialize'

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const TYPES = ['role', 'achievement', 'special', 'verification']

/** Daftar definisi badge + jumlah user yang memakainya. */
export async function GET() {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const Badge = await badgesCol()
    const Users = await appUsersCol()
    const docs = await Badge.find({}).sort({ createdAt: -1 }).toArray()

    const badges = await Promise.all(
      docs.map(async (b) => ({
        ...b,
        assignedCount: await Users.countDocuments({ badgeText: b.name }),
      })),
    )

    return NextResponse.json({ badges: toPlain(badges) })
  } catch (e) {
    console.error('GET /api/admin/badges gagal:', e)
    return serverError('Gagal memuat badge.')
  }
}

/** Buat definisi badge baru. */
export async function POST(req: NextRequest) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    const body = await req.json().catch(() => null)
    const name = String(body?.name ?? '').trim().toUpperCase()
    const description = String(body?.description ?? '').trim()
    const color = String(body?.color ?? '').trim().toUpperCase()
    const type = body?.type || 'role'

    if (!name) return NextResponse.json({ error: 'Nama badge wajib diisi.' }, { status: 400 })
    if (!HEX_RE.test(color)) {
      return NextResponse.json({ error: 'Warna harus format hex #RRGGBB.' }, { status: 400 })
    }
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipe badge tidak valid.' }, { status: 400 })
    }

    const Badge = await badgesCol()
    const exists = await Badge.findOne({ name })
    if (exists) {
      return NextResponse.json({ error: `Badge "${name}" sudah ada.` }, { status: 400 })
    }

    const now = new Date()
    const result = await Badge.insertOne({
      name,
      ...(description ? { description } : {}),
      color,
      type,
      isActive: true,
      createdBy: staff.email,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ ok: true, id: String(result.insertedId) }, { status: 201 })
  } catch (e) {
    console.error('POST /api/admin/badges gagal:', e)
    return serverError('Gagal membuat badge.')
  }
}
