import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Bot, FlaskConical, Home, KeyRound, LayoutGrid, LogIn, LogOut, Users } from 'lucide-react'
import { Button, Navbar, Sidebar } from '../ui'
import { useAuth } from '../core/auth'
import { MODULES } from '../core/modules'
import { ROLE_LABEL } from '../core/roles'

function UserArea() {
  const { user, logout } = useAuth()
  return user ? (
    <span className="row" style={{ gap: 8, marginLeft: 8 }}>
      <span className="muted" style={{ fontSize: 13 }}>{user.name} · {ROLE_LABEL[user.role] || user.role}{user.role !== 'admin' && user.college ? ` · ${user.college.code}` : ''}</span>
      <Button variant="ghost" size="sm" onClick={logout}><LogOut size={14} /> Sign out</Button>
    </span>
  ) : (
    <Button as={Link} to="/login" size="sm" style={{ marginLeft: 8 }}><LogIn size={14} /> Sign in</Button>
  )
}

const publicLinks = [{ to: '/', label: 'Home' }, { to: '/explore', label: 'Explore Labs' }, { to: '/#modules', label: 'Modules', plain: true }, { to: '/search', label: 'Search' }, { to: '/assistant', label: 'AI Assistant' }, { to: '/portal', label: 'Portal' }]

function Footer() {
  return (
    <footer style={{ background: 'var(--c-ink)', color: 'var(--c-on-ink)', padding: 'var(--s-6) 0', marginTop: 'var(--s-7)' }}>
      <div className="container row" style={{ justifyContent: 'space-between' }}>
        <span className="row"><img className="logo-chip" src="/logo.jpg" alt="Vishnu Universal Learning logo" height="52" /><span><b>SVES Connect</b><br /><small>Sri Vishnu Educational Society · svesconnect.in</small></span></span>
        <small>© {new Date().getFullYear()} Sri Vishnu Educational Society. All rights reserved.</small>
      </div>
    </footer>
  )
}

export function PublicLayout() {
  return (<><Navbar links={publicLinks} right={<UserArea />} /><Outlet /><Footer /></>)
}

export function PortalLayout() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const c = user?.college?.code?.toLowerCase()
  const mine = !user ? [] : {
    principal: [{ to: `/c/${c}/lab-details`, label: 'Labs & equipment', icon: FlaskConical }, { to: `/c/${c}/hods`, label: 'Heads of Department', icon: Users }],
    hod: [{ to: `/c/${c}/lab-details`, label: 'Labs & equipment', icon: FlaskConical }, { to: `/c/${c}/labs`, label: 'Lab Coordinators', icon: Users }],
    lab_incharge: [{ to: `/c/${c}/lab`, label: 'My lab', icon: FlaskConical }],
  }[user.role] || []
  const groups = [
    ...(mine.length ? [{ title: user.college.code, items: [...mine, { to: '/change-password', label: 'Change password', icon: KeyRound }] }] : []),
    { title: 'Portal', items: [{ to: '/portal', label: 'Overview', icon: LayoutGrid }, { to: '/', label: 'Public home', icon: Home }] },
    { title: 'Modules', items: [...MODULES.filter((m) => !m.roles || m.roles.includes(user?.role)).map((m) => ({ to: m.path, label: m.label, icon: m.icon })), { to: '/assistant', label: 'AI Assistant', icon: Bot }] },
  ]
  return (
    <>
      <Navbar links={[]} right={<UserArea />} onMenu={() => setOpen(!open)} />
      <div className="layout">
        <Sidebar groups={groups} open={open} onNavigate={() => setOpen(false)} />
        <main className="main"><Outlet /></main>
      </div>
    </>
  )
}
