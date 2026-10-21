export const DURATIONS = { focus: 25 * 60, break: 5 * 60 } // in seconds

// The timer is saved to localStorage so a refresh doesn't lose it. This function decides what
// a saved timer means NOW, when the page has just been reopened. It returns null when the saved
// data is missing or unusable, otherwise the timer's state plus `finished`:
//   - it was running and time is left   -> keep running, with the new remaining time
//   - it was running and time ran out   -> finished: true (the store then saves the session)
//   - it was paused                     -> restored exactly as it was
export function restoreTimer(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object') return null

  const total = DURATIONS[saved.mode]
  if (!total) return null

  const base = {
    mode: saved.mode,
    startedAt: typeof saved.startedAt === 'string' ? saved.startedAt : null,
    taskId: typeof saved.taskId === 'string' ? saved.taskId : null
  }

  if (saved.running && typeof saved.endsAt === 'number') {
    const remaining = Math.ceil((saved.endsAt - now) / 1000)
    if (remaining <= 0) return { ...base, running: false, remaining: 0, endsAt: 0, finished: true }
    return { ...base, running: true, remaining: Math.min(remaining, total), endsAt: saved.endsAt, finished: false }
  }

  const remaining = Number.isFinite(saved.remaining) ? saved.remaining : total
  return {
    ...base,
    running: false,
    remaining: Math.min(Math.max(Math.round(remaining), 1), total),
    endsAt: 0,
    finished: false
  }
}
