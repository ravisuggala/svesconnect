import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { api, getToken, setToken } from './api'
import { homePath } from './roles'
import { Loader } from '../ui'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!getToken())

  useEffect(() => {
    if (!getToken()) return
    api('/auth/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  const login = useCallback(async (college, email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { college, email, password } })
    setToken(r.token); setUser(r.user); return r.user
  }, [])
  const logout = useCallback(() => { setToken(null); setUser(null) }, [])
  const refresh = useCallback(async () => { const r = await api('/auth/me'); setUser(r.user); return r.user }, [])

  return <AuthCtx.Provider value={{ user, ready, login, logout, refresh }}>{children}</AuthCtx.Provider>
}

const Wait = () => <div style={{ padding: 48, textAlign: 'center' }}><Loader label="Loading…" /></div>

/** Requires sign-in (and optionally a role). Users still on the default password are sent to change it first. */
export function RequireAuth({ roles, allowDefaultPassword, children }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <Wait />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (user.mustChangePassword && !allowDefaultPassword) return <Navigate to="/change-password" replace />
  // a college administrator has administrator rights inside their own college
  if (roles && !roles.includes(user.role) && !(user.role === 'college_admin' && roles.includes('admin'))) return <Navigate to={homePath(user)} replace />
  return children
}

/** Wraps /c/:college/*: signed in, and inside their own college (admins may enter any college). */
export function CollegeGuard() {
  const { user, ready } = useAuth()
  const { college } = useParams()
  const loc = useLocation()
  if (!ready) return <Wait />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  if (user.role !== 'admin' && user.college.code.toLowerCase() !== college.toLowerCase()) return <Navigate to={homePath(user)} replace />
  return <Outlet />
}
