import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, getToken, setToken } from './api'
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

  const login = useCallback(async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } })
    setToken(r.token); setUser(r.user); return r.user
  }, [])
  const register = useCallback(async (data) => {
    const r = await api('/auth/register', { method: 'POST', body: data })
    setToken(r.token); setUser(r.user); return r.user
  }, [])
  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  return <AuthCtx.Provider value={{ user, ready, login, register, logout }}>{children}</AuthCtx.Provider>
}

export function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <div style={{ padding: 48, textAlign: 'center' }}><Loader label="Loading…" /></div>
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/portal" replace />
  return children
}
