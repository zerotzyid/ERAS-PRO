/**
 * Seed akun admin awal + badge bawaan (driver MongoDB native).
 * Jalankan:  npm run seed
 * Membaca konfigurasi dari .env.local (atau environment).
 *
 * Cukup dijalankan SEKALI dari komputer lokal setelah env diisi.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile() {
  const path = join(rootDir, '.env.local')
  if (!existsSync(path)) return
  const lines = readFileSync(path, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile()

const ADMIN_URI = process.env.ADMIN_MONGODB_URI || process.env.MONGODB_URI
const ADMIN_DB = process.env.ADMIN_DB_NAME || 'rinova_admin'
const APP_URI = process.env.APP_MONGODB_URI || process.env.MONGODB_URI
const APP_DB = process.env.APP_DB_NAME || 'rinova'

const SEED_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@rinova.local').toLowerCase()
const SEED_NAME = process.env.SEED_ADMIN_NAME || 'Rinova Admin'
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD || ''

async function main() {
  if (!ADMIN_URI) {
    console.error('❌ MONGODB_URI / ADMIN_MONGODB_URI belum diisi di .env.local')
    process.exit(1)
  }
  if (!SEED_PASSWORD || SEED_PASSWORD.length < 8) {
    console.error('❌ SEED_ADMIN_PASSWORD minimal 8 karakter. Isi di .env.local lalu ulangi.')
    process.exit(1)
  }

  // 1) Admin panel
  const adminClient = new MongoClient(ADMIN_URI)
  await adminClient.connect()
  const admins = adminClient.db(ADMIN_DB).collection('admins')
  await admins.createIndex({ email: 1 }, { unique: true }).catch(() => {})
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12)
  await admins.updateOne(
    { email: SEED_EMAIL },
    {
      $set: { name: SEED_NAME, passwordHash, role: 'admin', updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  )
  console.log(`✅ Admin siap: ${SEED_EMAIL} (db: ${ADMIN_DB})`)
  await adminClient.close()

  // 2) Badge bawaan di database aplikasi
  if (APP_URI) {
    const appClient = new MongoClient(APP_URI)
    await appClient.connect()
    const badges = appClient.db(APP_DB).collection('badges')
    await badges.createIndex({ name: 1 }, { unique: true }).catch(() => {})
    const defaults = [
      { name: 'ADMIN', description: 'Administrator Rinova', color: '#EF4444', type: 'role' },
      { name: 'MOD', description: 'Moderator Rinova', color: '#3B82F6', type: 'role' },
      { name: 'VIP', description: 'Member Premium', color: '#F59E0B', type: 'role' },
      { name: 'VERIFIED', description: 'Akun terverifikasi', color: '#10B981', type: 'verification' },
    ]
    for (const b of defaults) {
      await badges.updateOne(
        { name: b.name },
        { $setOnInsert: { ...b, isActive: true, createdBy: 'seed', createdAt: new Date() } },
        { upsert: true },
      )
    }
    console.log(`✅ Badge bawaan siap (db: ${APP_DB})`)
    await appClient.close()
  }

  console.log('🎉 Seed selesai. Silakan login via halaman /auth/signin')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed gagal:', err.message)
  process.exit(1)
})
