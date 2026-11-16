export const empty = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0)

/** Mirrors the server rule: conditional fields (showIf) and high-value-only fields (cost above the threshold). */
export function visible(field, data, highValueLakhs = 1.5) {
  if (field.highValue && !(Number(data.equipment_cost_lakhs) > highValueLakhs)) return false
  const c = field.showIf
  if (!c) return true
  const v = data[c.key]
  if (c.equals !== undefined) return v === c.equals
  if (c.in) return c.in.includes(v)
  return !empty(v)
}

/** Which uploads are worth asking about for this record (all stay optional). */
export function fileKindVisible(kind, data, highValueLakhs = 1.5) {
  const high = Number(data.equipment_cost_lakhs) > highValueLakhs
  if (kind === 'invoice') return high
  if (kind === 'amc_contract') return data.amc_required === 'Yes'
  if (kind === 'training') return data.training_provided === 'Yes'
  return true
}

export const STATUS = {
  draft: { label: 'Draft', tone: '' }, submitted: { label: 'Awaiting HOD', tone: 'warning' }, verified: { label: 'Awaiting Principal', tone: 'primary' },
  approved: { label: 'Published', tone: 'success' }, rejected: { label: 'Needs changes', tone: 'error' },
}
