export const ROLE_LABEL = {
  admin: 'Administrator', principal: 'Principal', hod: 'Head of Department', lab_incharge: 'Lab Coordinator',
  faculty: 'Faculty', student: 'Student', external: 'External',
}

/** Where each user lands after signing in. College routes are /c/<college code>/... */
export function homePath(u) {
  if (!u) return '/login'
  if (u.mustChangePassword) return '/change-password'
  const c = u.college?.code?.toLowerCase()
  switch (u.role) {
    case 'principal': return `/c/${c}/hods`
    case 'hod': return `/c/${c}/labs`
    case 'lab_incharge': return `/c/${c}/lab`
    default: return '/portal'
  }
}
