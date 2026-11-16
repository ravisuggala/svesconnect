import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, Input, Select, useToast } from '../ui'
import { useAuth } from '../core/auth'
import { api } from '../core/api'
import { homePath } from '../core/roles'
import './login.css'

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export default function Login() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const [colleges, setColleges] = useState([])
  const [f, setF] = useState({ college: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => { api('/colleges').then((r) => setColleges(r.colleges)).catch(() => setErrors({ form: 'Could not load the college list. Please refresh.' })) }, [])

  if (user) return <Navigate to={homePath(user)} replace />

  const submit = async (ev) => {
    ev.preventDefault()
    const e = {}
    if (!f.college) e.college = 'Choose your college.'
    if (!emailOk(f.email)) e.email = 'Enter a valid email address.'
    if (!f.password) e.password = 'Enter your password.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      const u = await login(f.college, f.email, f.password)
      toast('Welcome to SVES Connect')
      nav(u.mustChangePassword ? '/change-password' : (loc.state?.from || homePath(u)), { replace: true })
    } catch (err) {
      setErrors(err.fields || { form: err.message })
    } finally { setBusy(false) }
  }

  const options = [{ value: '', label: 'Select your college…' }, ...colleges.map((c) => ({ value: c.code, label: c.isCentral ? c.name : `${c.name} (${c.code}), ${c.city}` }))]

  return (
    <div className="login-page">
      <div className="login-side">
        <img className="logo-chip" src="/logo.jpg" alt="Vishnu Universal Learning logo" height="110" />
        <h2>SVES Connect</h2>
        <p>Sri Vishnu Educational Society. One portal for infrastructure, events, projects and research across all SVES institutions.</p>
      </div>
      <div className="login-form">
        <Card className="fade-up" style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{ fontSize: '1.5rem' }}>Sign in</h2>
          <p className="muted">Principals, HODs and lab coordinators all sign in here. Choose your college first.</p>
          <form onSubmit={submit} noValidate>
            <Select label="College" value={f.college} onChange={set('college')} options={options} error={errors.college} />
            <Input label="Email" type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="username" />
            <Input label="Password" type="password" value={f.password} onChange={set('password')} error={errors.password} autoComplete="current-password" />
            {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
            <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Please wait…' : 'Sign in'}</Button>
          </form>
          <p className="muted" style={{ marginTop: 'var(--s-4)', fontSize: 13 }}>Accounts are created by your Principal (HODs) and your HOD (lab coordinators). Ask them if you need access.</p>
        </Card>
      </div>
    </div>
  )
}
