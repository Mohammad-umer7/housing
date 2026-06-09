// Admin portal shell. Server-side RBAC runs before anything renders: the HMAC
// session cookie is verified here, so a non-admin session never sees a flash of
// admin UI — officers bounce to /officer, everyone else to /login.

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { readSessionFromCookieHeader } from '@/lib/auth/session'
import AdminHeader from '@/components/AdminHeader'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers()
  const session = await readSessionFromCookieHeader(headerStore.get('cookie'))
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect(session.role === 'officer' ? '/officer' : '/login')

  return (
    <div className="page" style={{ background: 'var(--panel-alt)', minHeight: '100vh' }}>
      <AdminHeader username={session.username} />
      <div className="officer-body">
        <div className="officer-wrap" style={{ maxWidth: 1240 }}>{children}</div>
      </div>
    </div>
  )
}
