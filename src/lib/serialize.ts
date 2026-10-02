/**
 * Konversi dokumen Mongo (lean) menjadi JSON-safe.
 * Menangani BSON Long/Int32/Double/ObjectId/Date dari database aplikasi.
 */
export function toPlain<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => toPlain(v)) as unknown as T
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    // BSON Long / Int32 / Double
    if (typeof v.toNumber === 'function') {
      try {
        return (v as unknown as { toNumber(): number }).toNumber() as unknown as T
      } catch {
        return String(value) as unknown as T
      }
    }
    // BSON ObjectId
    if (typeof v.toHexString === 'function') {
      return String(value) as unknown as T
    }
    if (v._bsontype) return String(value) as unknown as T
    if (value instanceof Date) return value.toISOString() as unknown as T
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(v)) {
      if (key === '__v') continue
      out[key] = toPlain(v[key])
    }
    return out as unknown as T
  }
  return value
}

/** Waktu bergabung user aplikasi ≈ timestamp ObjectId (dokumen dibuat saat sync pertama). */
export function joinedFromObjectId(id: unknown): string | null {
  try {
    const v = id as { getTimestamp?: () => Date }
    if (v && typeof v.getTimestamp === 'function') {
      return v.getTimestamp().toISOString()
    }
  } catch {
    // abaikan
  }
  return null
}
