import { redirect } from 'next/navigation'

// Entri utama — middleware mengarahkan ke /dashboard (sudah login)
// atau /auth/signin (belum login). Redirect ganda sebagai pengaman.
export default function Home() {
  redirect('/dashboard')
}
