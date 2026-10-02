/** Format tanggal ke Bahasa Indonesia, mis. "2 Okt 2026, 14.30" */
export function formatDateTime(input?: string | number | Date | null): string {
  if (input === undefined || input === null || input === '') return '—'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Format tanggal saja, mis. "2 Okt 2026" */
export function formatDate(input?: string | number | Date | null): string {
  if (input === undefined || input === null || input === '') return '—'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format angka ribuan Indonesia, mis. 12.345 */
export function formatNumber(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '0'
  return new Intl.NumberFormat('id-ID').format(n)
}

/** Waktu relatif, mis. "5 mnt lalu" */
export function timeAgo(input?: string | number | Date | null): string {
  if (!input) return '—'
  const d = input instanceof Date ? new Date(input) : new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 0) return 'baru saja'
  const menit = Math.floor(diff / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} mnt lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari < 30) return `${hari} hari lalu`
  const bulan = Math.floor(hari / 30)
  if (bulan < 12) return `${bulan} bln lalu`
  return `${Math.floor(bulan / 12)} thn lalu`
}
