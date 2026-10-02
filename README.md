# Rinova Web Control

Website monitoring & panel kontrol untuk **Rinova Streaming App** (Android).
Kelola pengguna, ban/suspend, premium, badge, dan pengumuman — semua tersambung
langsung ke database asli aplikasi (MongoDB Atlas `rinova`).

## Fitur

| Halaman | Fungsi |
|---|---|
| Beranda (`/dashboard`) | Statistik real-time: total user, premium, ban aktif, user aktif 7 hari, dsb. |
| Pengguna | Cari (email/nama/username/UID), filter status & premium, detail profil, aksi cepat premium/badge/ban |
| Ban & Suspend | Blokir permanen / suspend berjangka + alasan, cabut hukuman (pulihkan otomatis) |
| Premium | Beri/perpanjang/cabut premium (bulanan/tahunan/lifetime), riwayat grant |
| Badge | CRUD definisi badge + pasang/lepas badge ke user (tampil di profil & komentar aplikasi) |
| Pengumuman | Buat/tayangkan/hentikan pengumuman per audiens (semua/gratis/premium) + kedaluwarsa |
| Update App | Terbitkan versi baru (wajib/opsional + changelog + link APK) — aplikasi cek otomatis |
| Pengaturan | Status koneksi DB, kelola akun admin/moderator, ganti password |

Endpoint publik untuk aplikasi: `GET /api/public/announcements?isPremium=true&limit=5`
Endpoint cek update: `GET /api/public/app-update?versionCode=1`

## API Agen AI (`/agent`)

Endpoint JSON agar AI/automasi bisa mengelola panel secara programatik.

- `GET /agent` → manifest publik (daftar aksi + skema parameter, tanpa auth)
- `POST /agent` → `{"action": "...", "params": {...}, "actor": "nama-opsional"}`
  dengan header `Authorization: Bearer AGENT_API_KEY` (isi di env)

Aksi: `ping`, `announcements.create/list`, `app_updates.publish/latest`,
`users.lookup/setPremium/setBadge`, `bans.create/revoke`. Semua penulisan
memakai logika yang sama dengan panel (ban ganda ditolak, status user ditulis,
riwayat dicatat). API key bisa dilihat admin di Pengaturan → Akses Agen AI.

## Teknologi

- Next.js 14 (App Router) + React 18 + Tailwind CSS
- Driver MongoDB native (ringan, Vercel-friendly) — dua koneksi: `ADMIN_DB` (akun panel) + `APP_DB` (data aplikasi)
- Sesi JWT (cookie httpOnly) via `jose` — tanpa dependency auth berat, edge-safe
- Tanpa cron/scheduler: kedaluwarsa ban/suspend/premium/pengumuman dicek **lazy** setiap data dibaca
- Field tanggal opsional selalu disimpan **tanpa nilai** bila kosong (bukan null) agar filter tanggal akurat

## Jalankan lokal

```bash
npm install
cp .env.example .env.local   # lalu isi MONGODB_URI + SEED_ADMIN_PASSWORD
npm run seed                 # sekali saja: buat admin + badge bawaan
npm run dev                  # http://localhost:3000
```

Login dengan email & password dari `SEED_ADMIN_*`.

## Deploy ke Vercel (free tier)

1. Push repo ke GitHub → Import di Vercel (framework preset Next.js).
2. Isi Environment Variables (sama seperti `.env.example`):
   - `MONGODB_URI` (Atlas; **Network Access → Allow 0.0.0.0/0** karena IP Vercel dinamis)
   - `ADMIN_DB_NAME` = `rinova_admin`, `APP_DB_NAME` = `rinova`
   - `AUTH_SECRET` (string acak ≥ 32 karakter)
   - `SEED_ADMIN_*` (hanya untuk seed lokal, tidak dipakai Vercel)
3. Deploy. `npm run seed` tetap dijalankan **dari komputer lokal** (sekali saja).
4. `NEXTAUTH_URL` tidak diperlukan di Vercel.

## Perubahan di aplikasi Android

Agar ban & pengumuman berlaku di HP (`E:\ZEROPROTOTYPE\RINOVA-APP`):

- `core/mongo/MongoSyncRepository.kt`
  - `UserProfile` membaca `status`, `banReason`, `banExpiresAt`, `premiumExpiresAt`;
    premium & suspend kedaluwarsa dihitung efektif (self-heal bila web belum menyapu).
  - `accountGate: StateFlow<AccountGate?>` — terisi otomatis setiap profil dibaca.
  - `fetchAnnouncements(isPremium)` membaca koleksi `announcements` langsung.
- `core/premium/PremiumManager.kt` — cache offline memakai `premiumExpiresAt`.
- `ui/components/RemoteControlOverlays.kt` (baru) — dialog blokir (wajib keluar)
  + dialog pengumuman (sekali per item, dilacak via DataStore)
  + dialog update (`AppUpdateDialog`: wajib = blokir + tombol unduh, opsional = bisa "Nanti").
- `ui/screens/MainScreen.kt` — menampung ketiga overlay (prioritas: hukuman > update > pengumuman)
  + cek update saat login (bandingkan `versionCode` terpasang vs rilisan tayang).

Field baru di `rinova.users` (ditulis web, dibaca app): `status`, `banReason`,
`bannedAt`, `banExpiresAt`, `premiumExpiresAt`. Field lama tidak diubah.

Koleksi baru (ditulis web, dibaca app): `app_updates` — `versionCode`,
`versionName`, `apkUrl`, `changelog`, `mandatory`, `isPublished`.

## Skrip

| Skrip | Fungsi |
|---|---|
| `npm run dev` | development |
| `npm run build` | production build (wajib lolos sebelum deploy) |
| `npm run start` | jalankan hasil build |
| `npm run seed` | buat admin awal + badge bawaan (baca `.env.local`) |
# ERAS-PRO
