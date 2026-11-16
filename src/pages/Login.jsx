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
  const [mode, setMode] = useState('signin') // signin | change
  const [pw, setPw] = useState({ next: '', again: '' })
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

  const change = async (ev) => {
    ev.preventDefault()
    const e = {}
    if (!f.college) e.college = 'Choose your college.'
    if (!emailOk(f.email)) e.email = 'Enter a valid email address.'
    if (!f.password) e.password = 'Enter your current password.'
    if (pw.next.length < 8) e.next = 'Use at least 8 characters.'
    else if (pw.next !== pw.again) e.again = 'The two passwords do not match.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await api('/auth/change-password-login', { method: 'POST', body: { college: f.college, email: f.email, current: f.password, next: pw.next } })
      toast('Password changed. Sign in with your new password.')
      setF({ ...f, password: '' }); setPw({ next: '', again: '' }); setMode('signin')
    } catch (err) { setErrors(err.fields || { form: err.message }) } finally { setBusy(false) }
  }
  const switchMode = (m) => { setMode(m); setErrors({}) }

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
          {mode === 'signin' ? (<>
            <h2 style={{ fontSize: '1.5rem' }}>Sign in</h2>
            <p className="muted">Principals, HODs, coordinators and event teams all sign in here. Choose your college first.</p>
            <form onSubmit={submit} noValidate>
              <Select label="College" value={f.college} onChange={set('college')} options={options} error={errors.college} />
              <Input label="Email" type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="username" />
              <Input label="Password" type="password" value={f.password} onChange={set('password')} error={errors.password} autoComplete="current-password" />
              {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
              <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Please wait…' : 'Sign in'}</Button>
            </form>
            <p style={{ marginTop: 'var(--s-4)', fontSize: 14 }}>Want your own password? <a href="#change" onClick={(e) => { e.preventDefault(); switchMode('change') }}><b>Change password</b></a></p>
            <p className="muted" style={{ fontSize: 13 }}>Accounts are created by your Principal (HODs) and your HOD (lab coordinators). Forgot your password? Ask them to reset it.</p>
          </>) : (<>
            <h2 style={{ fontSize: '1.5rem' }}>Change password</h2>
            <p className="muted">Optional. Enter your college, email and current password, then choose a new one.</p>
            <form onSubmit={change} noValidate>
              <Select label="College" value={f.college} onChange={set('college')} options={options} error={errors.college} />
              <Input label="Email" type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="username" />
              <Input label="Current password" type="password" value={f.password} onChange={set('password')} error={errors.password} autoComplete="current-password" />
              <Input label="New password" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={errors.next} autoComplete="new-password" hint="At least 8 characters." />
              <Input label="New password again" type="password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} error={errors.again} autoComplete="new-password" />
              {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
              <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Please wait…' : 'Change password'}</Button>
            </form>
            <p style={{ marginTop: 'var(--s-4)', fontSize: 14 }}><a href="#signin" onClick={(e) => { e.preventDefault(); switchMode('signin') }}>← Back to sign in</a></p>
          </>)}
        </Card>
      </div>
    </div>
  )
}
