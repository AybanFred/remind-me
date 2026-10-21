// Task categories. The real list comes from the database (stores/categories.js); these are the
// three every user starts with, also used as a fallback if the categories table isn't set up yet.

import { isHexColor, readableTextOn } from '@/lib/color'

export const DEFAULT_CATEGORIES = [
  { key: 'upskilling', label: 'Upskilling', color: 'primary', position: 0 },
  { key: 'job_hunt', label: 'Job hunt', color: 'secondary', position: 1 },
  { key: 'daily', label: 'Daily', color: 'accent', position: 2 }
]

// A category colour is either a theme colour name (it changes with the theme) or a fixed hex.
export const THEME_COLORS = ['primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error', 'neutral']

// Written out in full so Tailwind can find the class names.
const BADGE = {
  primary: 'badge-soft badge-primary',
  secondary: 'badge-soft badge-secondary',
  accent: 'badge-soft badge-accent',
  info: 'badge-soft badge-info',
  success: 'badge-soft badge-success',
  warning: 'badge-soft badge-warning',
  error: 'badge-soft badge-error',
  neutral: 'badge-soft badge-neutral'
}
const DOT = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-neutral'
}

// Class and style for a badge in this colour (hex colours get a solid background with readable text).
export function badgeLook(color) {
  if (BADGE[color]) return { class: BADGE[color], style: null }
  if (isHexColor(color)) {
    return { class: '', style: { backgroundColor: color, borderColor: color, color: readableTextOn(color) } }
  }
  return { class: BADGE.neutral, style: null }
}

// Class and style for a small coloured dot.
export function dotLook(color) {
  if (DOT[color]) return { class: DOT[color], style: null }
  if (isHexColor(color)) return { class: '', style: { backgroundColor: color } }
  return { class: DOT.neutral, style: null }
}

// "Side projects!" -> "side_projects". Adds _2, _3, ... if that key is already taken.
export function slugify(label, takenKeys = []) {
  const base =
    String(label)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // é -> e
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'category'
  const taken = new Set(takenKeys)
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`
  return key
}

// For a task whose category was removed: "side_projects" -> "Side projects"
export function labelFromKey(key) {
  const text = String(key ?? '').replace(/_/g, ' ').trim()
  return text ? text[0].toUpperCase() + text.slice(1) : 'Uncategorized'
}
