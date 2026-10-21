// Calculations for the time tracker: data in, numbers and text out.
// No Vue and no database in here, so it is easy to test.

import { dateKey, startOfWeek } from '@/lib/stats'

const pad = (n) => String(n).padStart(2, '0')

// How long an entry lasted. A running entry (no end yet) counts up to `now`.
export function durationSeconds(entry, now = Date.now()) {
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now
  return Math.max(0, Math.floor((end - new Date(entry.started_at).getTime()) / 1000))
}

// 3725 -> "1:02:05" (the big running clock)
export function formatClock(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}:${pad(m)}:${pad(seconds % 60)}`
}

// 3725 -> "1h 02m", 1500 -> "25m", 40 -> "40s" (used in lists and totals)
export function formatHours(seconds) {
  if (seconds < 60) return `${seconds}s`
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h ? `${h}h ${pad(m)}m` : `${m}m`
}

// Hours as a decimal with two places, the way timesheets and invoices want it: 5400 -> 1.5
export function decimalHours(seconds) {
  return Math.round(seconds / 36) / 100
}

export function earnings(seconds, hourlyRate) {
  if (hourlyRate === null || hourlyRate === undefined) return null
  return Math.round((seconds / 3600) * Number(hourlyRate) * 100) / 100
}

export function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

// Groups entries by the day they started (in the user's time zone), newest day first,
// with the total time for each day.
export function groupByDay(entries, now = Date.now(), today = new Date()) {
  const todayKey = dateKey(today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = dateKey(yesterday)

  const days = new Map()
  const newestFirst = [...entries].sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
  for (const entry of newestFirst) {
    const started = new Date(entry.started_at)
    const key = dateKey(started)
    if (!days.has(key)) {
      const label =
        key === todayKey
          ? 'Today'
          : key === yesterdayKey
            ? 'Yesterday'
            : started.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      days.set(key, { key, label, seconds: 0, entries: [] })
    }
    const day = days.get(key)
    day.entries.push(entry)
    day.seconds += durationSeconds(entry, now)
  }
  return [...days.values()]
}

// Totals per project (and per task inside it), biggest first, with earnings when a rate is set.
export function summarizeByProject(entries, projects, now = Date.now()) {
  const projectById = new Map(projects.map((p) => [p.id, p]))
  const groups = new Map()

  for (const entry of entries) {
    const key = entry.project_id ?? 'none'
    if (!groups.has(key)) {
      const project = projectById.get(entry.project_id)
      groups.set(key, {
        projectId: entry.project_id ?? null,
        name: project?.name ?? 'No project',
        client: project?.client ?? '',
        color: project?.color ?? '#9ca3af',
        rate: project?.hourly_rate ?? null,
        seconds: 0,
        tasks: new Map()
      })
    }
    const group = groups.get(key)
    const seconds = durationSeconds(entry, now)
    group.seconds += seconds
    const taskKey = entry.task_id ?? 'none'
    group.tasks.set(taskKey, (group.tasks.get(taskKey) ?? 0) + seconds)
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      amount: earnings(g.seconds, g.rate),
      tasks: [...g.tasks].map(([taskId, seconds]) => ({ taskId: taskId === 'none' ? null : taskId, seconds })).sort((a, b) => b.seconds - a.seconds)
    }))
    .sort((a, b) => b.seconds - a.seconds)
}

// The date range for a report preset. `to` is the first moment AFTER the range.
export function rangeFor(preset, today = new Date()) {
  const startOfDay = new Date(today)
  startOfDay.setHours(0, 0, 0, 0)
  const plusDays = (date, n) => {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
  }

  if (preset === 'today') return { from: startOfDay, to: plusDays(startOfDay, 1) }

  const weekStart = startOfWeek(today)
  if (preset === 'week') return { from: weekStart, to: plusDays(weekStart, 7) }
  if (preset === 'lastWeek') return { from: plusDays(weekStart, -7), to: weekStart }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  if (preset === 'month') return { from: monthStart, to: new Date(today.getFullYear(), today.getMonth() + 1, 1) }
  if (preset === 'lastMonth') return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: monthStart }

  throw new Error(`Unknown range: ${preset}`)
}

// A cell that starts with = + - or @ would be run as a formula by Excel or Google Sheets.
// Task and project names are typed by the user, so neutralise those with a leading apostrophe.
function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// A timesheet as CSV text, one row per entry, oldest first.
export function buildCsv(entries, { projectById, taskById }, now = Date.now()) {
  const header = ['Date', 'Start', 'End', 'Hours', 'Project', 'Client', 'Task', 'Description', 'Hourly rate', 'Amount']
  const time = (iso) => {
    const d = new Date(iso)
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const rows = [...entries]
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
    .map((entry) => {
      const project = projectById.get(entry.project_id)
      const seconds = durationSeconds(entry, now)
      const amount = earnings(seconds, project?.hourly_rate)
      return [
        dateKey(new Date(entry.started_at)),
        time(entry.started_at),
        entry.ended_at ? time(entry.ended_at) : '',
        decimalHours(seconds),
        project?.name ?? '',
        project?.client ?? '',
        taskById.get(entry.task_id)?.name ?? '',
        entry.description,
        project?.hourly_rate ?? '',
        amount ?? ''
      ]
    })

  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
