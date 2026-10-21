// One place that defines the three task categories, so every screen shows them the same way.
// The badge classes are written out in full so Tailwind can find them.
export const categories = {
  upskilling: { label: 'Upskilling', badge: 'badge-primary' },
  job_hunt: { label: 'Job hunt', badge: 'badge-secondary' },
  daily: { label: 'Daily', badge: 'badge-accent' }
}

export const categoryList = Object.entries(categories).map(([value, c]) => ({ value, ...c }))
