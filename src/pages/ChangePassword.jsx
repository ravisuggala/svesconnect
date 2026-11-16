import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, useToast } from '../ui'
import { useAuth } from '../core/auth'
import { api } from '../core/api'
import { homePath } from '../core/roles'

export default function ChangePassword() {
  const { user, refresh } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (ev) => {
    ev.preventDefault()
    const e = {}
    if (!f.current) e.current = 'Enter your current password.'
    if (f.next.length < 8) e.next = 'Use at least 8 characters.'
    if (f.confirm !== f.next) e.confirm = 'Passwords do not match.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: { current: f.current, next: f.next } })
      const u = await refresh()
      toast('Password updated')
      nav(homePath(u), { replace: true })
    } catch (err) { setErrors(err.fields || { form: err.message }) } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--s-6) var(--s-4)' }}>
      <Card className="fade-up" style={{ width: '100%', maxWidth: 440 }}>
        <h2 style={{ fontSize: '1.5rem' }}>{user?.mustChangePassword ? 'Set a new password' : 'Change password'}</h2>
        {user?.mustChangePassword && <p className="muted">You are using the default password. Choose your own before continuing.</p>}
        <form onSubmit={submit} noValidate>
          <Input label="Current password" type="password" value={f.current} onChange={set('current')} error={errors.current} autoComplete="current-password" />
          <Input label="New password" type="password" value={f.next} onChange={set('next')} error={errors.next} hint="At least 8 characters, different from the default." autoComplete="new-password" />
          <Input label="Confirm new password" type="password" value={f.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
          {errors.form && <p role="alert" style={{ color: 'var(--c-error)' }}>{errors.form}</p>}
          <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Saving…' : 'Save password'}</Button>
        </form>
      </Card>
    </div>
  )
}
