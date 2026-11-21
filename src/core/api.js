const KEY = 'sves_token'
export const getToken = () => { try { return localStorage.getItem(KEY) } catch { return null } }
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch { /* storage unavailable */ } }

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  let res
  try { res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }) }
  catch { throw new Error('We could not reach the server. Please check your internet connection and try again.') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status, fields: data.fields })
  return data
}

/** Fetch a protected file with the sign-in token and open it in a new tab. */
export async function openFile(path) {
  const t = getToken()
  const res = await fetch(`/api${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
  if (!res.ok) throw new Error('Could not open the file')
  const url = URL.createObjectURL(await res.blob())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] || '')
  r.onerror = () => reject(r.error)
  r.readAsDataURL(file)
})

/** Fetch a protected file with the sign-in token and save it to disk. */
export async function downloadFile(path, name) {
  const t = getToken()
  const res = await fetch(`/api${path}${path.includes('?') ? '&' : '?'}download=1`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
  if (!res.ok) throw new Error('Could not download the file')
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
