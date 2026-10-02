import { Long } from 'bson'

/**
 * Konversi warna badge antara hex web (#RRGGBB) dan ARGB Long aplikasi Android.
 *
 * Aplikasi Android menyimpan `badgeColor` sebagai BSON Int64 ARGB
 * (contoh: 0xFF8B5CF6 = 4293982454). Nilai > 2^31, jadi TIDAK boleh ditulis
 * sebagai Number JS biasa (akan tersimpan sebagai Double dan gagal dibaca
 * oleh `doc.getLong()` di aplikasi). Selalu tulis sebagai `Long`.
 */

export const DEFAULT_BADGE_ARGB = 0xff8b5cf6

/** "#8B5CF6" (atau "8B5CF6") -> Long ARGB 0xFF8B5CF6 */
export function hexToArgbLong(hex: string): Long {
  const clean = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Warna hex tidak valid: "${hex}". Gunakan format #RRGGBB.`)
  }
  const rgb = parseInt(clean, 16)
  const argb = 0xff000000 + rgb
  return Long.fromNumber(argb)
}

/** Long/number ARGB -> "#8B5CF6" untuk ditampilkan di web */
export function argbToHex(value: unknown): string {
  let num: number
  if (typeof value === 'number') {
    num = value
  } else if (value != null && typeof (value as Long).toNumber === 'function') {
    num = (value as Long).toNumber()
  } else {
    return '#8B5CF6'
  }
  const rgb = num & 0xffffff
  return '#' + rgb.toString(16).padStart(6, '0').toUpperCase()
}

/** Nilai mentah (Long/number/Double) -> number JS untuk JSON */
export function argbToNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (value != null && typeof (value as Long).toNumber === 'function') {
    return (value as Long).toNumber()
  }
  return DEFAULT_BADGE_ARGB
}
