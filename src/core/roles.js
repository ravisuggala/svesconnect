export const ROLE_LABEL = {
  admin: 'Administrator', principal: 'Principal', hod: 'Head of Department', lab_incharge: 'Lab Coordinator', event_coordinator: 'Event Coordinator', event_member: 'Event Team Member',
  faculty: 'Faculty', student: 'Student', external: 'External',
}

/** Where each user lands after signing in. College routes are /c/<college code>/... */
export function homePath(u) {
  if (!u) return '/login'
  if (u.mustChangePassword) return '/change-password'
  const c = u.college?.code?.toLowerCase()
  switch (u.role) {
    case 'principal': return `/c/${c}/lab-details`
    case 'hod': return `/c/${c}/lab-details`
    case 'lab_incharge': return `/c/${c}/lab`
    case 'event_coordinator':
    case 'event_member': return u.eventId ? `/c/${c}/event/${u.eventId}` : '/portal'
    default: return '/portal'
  }
}
