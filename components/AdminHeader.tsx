'use client'

// Admin portal top bar — same federal lockup language as the officer header
// (gov-rule + officer-top), with the admin section tabs from the SADDAD admin
// portal: Overview · Cases · Users · Feedback · Settings.

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'

const TABS = [
  { href: '/admin', label: 'Overview', ar: 'نظرة عامة' },
  { href: '/admin/cases', label: 'Cases', ar: 'الحالات' },
  { href: '/admin/users', label: 'Users', ar: 'المستفيدون' },
  { href: '/admin/feedback', label: 'Feedback', ar: 'الملاحظات' },
  { href: '/admin/settings', label: 'Settings', ar: 'الإعدادات' },
]

export default function AdminHeader({ username }: { username: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useA11y()

  function isActive(href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('saddad_logged_in')
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="officer-top">
      <div className="gov-rule" />
      <div className="officer-top-inner">
        <div className="officer-brand"><Ico.building /> {t('Admin Portal', 'بوابة الإدارة')}</div>
        <div className="internal-tag">{t('SADDAD Administration')} <span className="ar">— وزارة الطاقة والبنية التحتية</span></div>
        <div className="officer-links">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={isActive(tab.href) ? 'active' : ''}>
              {t(tab.label, tab.ar)}
            </Link>
          ))}
          <span className="muted" style={{ fontSize: 13.5 }}><Ico.user width={14} height={14} style={{ verticalAlign: -2 }} /> {username}</span>
          <button onClick={handleLogout}><Ico.logout width={15} height={15} style={{ verticalAlign: -2 }} /> {t('Logout', 'تسجيل الخروج')}</button>
        </div>
      </div>
    </div>
  )
}
