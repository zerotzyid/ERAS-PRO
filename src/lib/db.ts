import { MongoClient, type Db } from 'mongodb'

/**
 * Dua koneksi MongoDB native (ringan, tanpa type-inference berat):
 * - ADMIN: database akun admin panel web (default: rinova_admin)
 * - APP:   database aplikasi Android Rinova (default: rinova)
 *
 * Satu cluster Atlas cukup — bedakan nama database.
 * Koneksi dibuat LAZY dan di-cache di globalThis agar dipakai ulang
 * antar serverless invocation di Vercel free tier.
 * Modul ini TIDAK boleh throw saat di-import (penting untuk `next build`).
 */

type CacheEntry = {
  client: MongoClient | null
  promise: Promise<MongoClient> | null
}

declare global {
  // eslint-disable-next-line no-var
  var __rinovaMongoCache: Record<'admin' | 'app', CacheEntry> | undefined
}

function getCache(): Record<'admin' | 'app', CacheEntry> {
  if (!globalThis.__rinovaMongoCache) {
    globalThis.__rinovaMongoCache = {
      admin: { client: null, promise: null },
      app: { client: null, promise: null },
    }
  }
  return globalThis.__rinovaMongoCache
}

async function connect(
  key: 'admin' | 'app',
  uri: string | undefined,
  dbName: string,
): Promise<Db> {
  const cache = getCache()[key]

  if (cache.client) return cache.client.db(dbName)

  if (!uri) {
    const varName = key === 'admin' ? 'ADMIN_MONGODB_URI / MONGODB_URI' : 'APP_MONGODB_URI / MONGODB_URI'
    throw new Error(
      `Variabel environment ${varName} belum diisi. Salin .env.example ke .env.local lalu isi nilainya.`,
    )
  }

  if (!cache.promise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    })
    cache.promise = client.connect()
  }

  try {
    const client = await cache.promise
    cache.client = client
    return client.db(dbName)
  } catch (e) {
    cache.promise = null
    throw e
  }
}

/** Database ADMIN (akun admin panel web). */
export function connectAdminDB(): Promise<Db> {
  return connect(
    'admin',
    process.env.ADMIN_MONGODB_URI || process.env.MONGODB_URI,
    process.env.ADMIN_DB_NAME || 'rinova_admin',
  )
}

/** Database APP (data asli aplikasi Android Rinova). */
export function connectAppDB(): Promise<Db> {
  return connect(
    'app',
    process.env.APP_MONGODB_URI || process.env.MONGODB_URI,
    process.env.APP_DB_NAME || 'rinova',
  )
}
