// Pure functions for the dashboard: data in, numbers out. No Supabase and no Vue in here,
// which keeps them easy to read and easy to unit-test.

// "2026-10-21" in the user's LOCAL time zone. (toISOString() would use UTC and can
// put a late-evening task on the wrong day.)
export function dateKey(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Midday avoids daylight-saving edge cases when stepping back one day at a time.
function atNoon(date) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  return d
}

// Consecutive days, ending today, with at least one completed task or focus session.
// If today has nothing yet the streak isn't broken - we start counting from yesterday.
export function calcStreak(activeDays, today = new Date()) {
  const day = atNoon(today)
  if (!activeDays.has(dateKey(day))) day.setDate(day.getDate() - 1)

  let streak = 0
  while (activeDays.has(dateKey(day))) {
    streak++
    day.setDate(day.getDate() - 1)
  }
  return streak
}

// Monday 00:00 of the current week, local time.
export function startOfWeek(today = new Date()) {
  const d = new Date(today)
  d.setHours(0, 0, 0, 0)
  const daysSinceMonday = (d.getDay() + 6) % 7 // Sunday is 0 in JS, so shift it
  d.setDate(d.getDate() - daysSinceMonday)
  return d
}

// Completed tasks since Monday, counted per category.
export function completedThisWeek(tasks, today = new Date()) {
  const counts = { upskilling: 0, job_hunt: 0, daily: 0 }
  const weekStart = startOfWeek(today)
  for (const task of tasks) {
    if (task.completed_at && new Date(task.completed_at) >= weekStart) counts[task.category]++
  }
  return counts
}

// Focus minutes for each of the last `count` days, oldest first - ready for a chart.
export function focusMinutesPerDay(sessions, count = 7, today = new Date()) {
  const days = []
  for (let i = count - 1; i >= 0; i--) {
    const d = atNoon(today)
    d.setDate(d.getDate() - i)
    days.push({ key: dateKey(d), date: d, minutes: 0 })
  }
  const byKey = new Map(days.map((day) => [day.key, day]))
  for (const session of sessions) {
    const day = byKey.get(dateKey(new Date(session.started_at)))
    if (day) day.minutes += session.minutes_focused
  }
  return days
}

// 85 -> "1h 25m", 40 -> "40m"
export function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}
