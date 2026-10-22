// Helpers for the in-app notification list (the bell in the top bar). No browser APIs here,
// so they are easy to test. The store (stores/notifications.js) keeps the list itself.

export const MAX_ITEMS = 50 // older notifications fall off the end

// Puts new items at the top of the list (the last one given ends up first) and trims it.
export function addItems(list, items) {
  return [...[...items].reverse(), ...list].slice(0, MAX_ITEMS)
}

// "just now", "5m", "3h", "2d", then a short date - like most apps' notification lists.
export function timeAgo(iso, now = new Date()) {
  const seconds = Math.max(0, (now - new Date(iso)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
