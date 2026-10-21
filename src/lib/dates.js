// <input type="datetime-local"> works with local strings like "2026-10-21T14:30",
// while Supabase stores a full UTC timestamp. These two helpers convert between them.

export function localInputToIso(value) {
  return value ? new Date(value).toISOString() : null
}

export function isoToLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDue(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
