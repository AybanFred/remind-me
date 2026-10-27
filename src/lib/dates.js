import { dateKey } from '@/lib/stats'

// <input type="datetime-local"> works with local strings like "2026-10-21T14:30",
// while Supabase stores a full UTC timestamp. These two helpers convert between them.

const pad = (n) => String(n).padStart(2, '0')

export function localInputToIso(value) {
  return value ? new Date(value).toISOString() : null
}

export function isoToLocalInput(iso) {
  return iso ? toLocalInput(new Date(iso)) : ''
}

// A Date as "2026-10-21T14:30", in local time.
export function toLocalInput(date) {
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDue(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

// ---------- The due date picker ----------

function at(date, hours, minutes = 0) {
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// The one-tap choices at the top of the picker.
export function duePresets(now = new Date()) {
  const presets = []

  // "Today" is this evening, or two hours from now once it's nearly evening.
  // Late at night there's no sensible "today" left, so it's left out.
  let later = at(now, 18)
  if (later - now < 60 * 60 * 1000) later = at(now, now.getHours() + 2)
  if (dateKey(later) === dateKey(now)) presets.push({ key: 'today', label: 'Today', date: later })

  presets.push({ key: 'tomorrow', label: 'Tomorrow', date: at(addDays(now, 1), 9) })

  const weekday = now.getDay() // Sunday is 0, Saturday is 6
  const isWeekend = weekday === 0 || weekday === 6
  presets.push({
    key: 'weekend',
    label: isWeekend ? 'Next weekend' : 'This weekend',
    date: at(addDays(now, 6 - weekday || 7), 10) // the coming Saturday
  })
  presets.push({
    key: 'next_week',
    label: 'Next week',
    date: at(addDays(now, (8 - weekday) % 7 || 7), 9) // the coming Monday
  })

  return presets
}

// The time a day gets when you pick it before choosing a time: 9 AM, or the next full hour
// when 9 AM has already gone by today.
export function defaultTimeFor(day, now = new Date()) {
  if (day !== dateKey(now) || now.getHours() < 9) return '09:00'
  return now.getHours() >= 23 ? '23:59' : `${pad(now.getHours() + 1)}:00`
}

// "Today, 6:00 PM", "Tomorrow, 9:00 AM", "Sat, Oct 31, 10:00 AM" (plus the year if it isn't this year).
export function formatDueLabel(value, now = new Date()) {
  const date = new Date(value)
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((at(date, 12) - at(now, 12)) / 86_400_000)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Tomorrow, ${time}`
  if (days === -1) return `Yesterday, ${time}`
  const options = { weekday: 'short', month: 'short', day: 'numeric' }
  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric'
  return `${date.toLocaleDateString([], options)}, ${time}`
}

// "in 3 hours", "2 days ago", ...
export function relativeDue(value, now = new Date()) {
  const format = new Intl.RelativeTimeFormat([], { numeric: 'always' })
  const minutes = Math.round((new Date(value) - now) / 60_000)
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(hours, 'hour')
  return format.format(Math.round(hours / 24), 'day')
}
