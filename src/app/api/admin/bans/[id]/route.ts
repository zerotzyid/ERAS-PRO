import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serverError, unauthorized } from '@/lib/api-auth'
import { BanActionError, revokeBanRecord } from '@/lib/ban-actions'

/** Cabut ban/suspend (pulihkan user bila tidak ada ban aktif lain). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff()
  if (!staff) return unauthorized()

  try {
    await revokeBanRecord(params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof BanActionError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('DELETE /api/admin/bans/[id] gagal:', e)
    return serverError('Gagal mencabut ban.')
  }
}
