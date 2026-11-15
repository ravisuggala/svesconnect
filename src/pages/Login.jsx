import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, Input, Select, useToast } from '../ui'
import { useAuth } from '../core/auth'
import './login.css'

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export default function Login() {
  const { user, login, register } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  if (user) return <Navigate to={loc.state?.from || '/portal'} replace />

  const validate = () => {
    const e = {}
    if (mode === 'register' && f.name.trim().length < 2) e.name = 'Enter your full name.'
    if (!emailOk(f.email)) e.email = 'Enter a valid email address.'
    if (f.password.length < (mode === 'register' ? 8 : 1)) e.password = mode === 'register' ? 'Use at least 8 characters.' : 'Enter your password.'
    setErrors(e)
    return !Object.keys(e).length
  }
  const submit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setBusy(true)
    try {
      if (mode === 'login') await login(f.email, f.password)
      else await register(f)
      toast('Welcome to SVES Connect')
      nav(loc.state?.from || '/portal', { replace: true })
    } catch (err) {
      setErrors(err.fields || { form: err.message })
    } finally { setBusy(false) }
  }

  return (
    <div className="login-page">
      <div className="login-side">
        <img className="logo-chip" src="/logo.jpg" alt="Vishnu Universal Learning logo" height="110" />
        <h2>SVES Connect</h2>
        <p>Sri Vishnu Educational Society. One portal for infrastructure, events, projects and research across all SVES institutions.</p>
      </div>
      <div className="login-form">
        <Card className="fade-up" style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontSize: '1.5rem' }}>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
          <p className="muted">{mode === 'login' ? 'Use the email you registered with.' : 'Any email address can be used to register.'}</p>
          <form onSubmit={submit} noValidate>
            {mode === 'register' && <Input label="Full name" value={f.name} onChange={set('name')} error={errors.name} autoComplete="name" />}
            <Input label="Email" type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            <Input label="Password" type="password" value={f.password} onChange={set('password')} error={errors.password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'register' && <Select label="I am a" value={f.role} onChange={set('role')} options={[{ value: 'student', label: 'Student' }, { value: 'faculty', label: 'Faculty / Staff' }, { value: 'external', label: 'Industry / External' }]} hint="Higher roles (HOD, Principal, Admin) are assigned by an administrator." />}
            {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
            <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</Button>
          </form>
          <p style={{ marginTop: 'var(--s-4)', textAlign: 'center' }}>
            {mode === 'login' ? 'New here? ' : 'Already registered? '}
            <a href="#" onClick={(e) => { e.preventDefault(); setErrors({}); setMode(mode === 'login' ? 'register' : 'login') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</a>
          </p>
        </Card>
      </div>
    </div>
  )
}
