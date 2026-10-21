// Personal appearance settings: brand colours, font and celebration effects.
// They sit ON TOP of whichever theme is selected, and "null" always means "use the theme's own value".

import { isHexColor, readableTextOn } from '@/lib/color'

const KEY = 'appearance'
const COLOR_NAMES = ['primary', 'secondary', 'accent']

export const defaultPrefs = { primary: null, secondary: null, accent: null, font: null, confetti: true }

// Fonts offered in the picker. They load from Google Fonts only when chosen, so the
// default experience stays fast. Anyone can also type the name of any other Google Font.
export const FONT_PRESETS = [
  { name: 'Inter', kind: 'sans' },
  { name: 'DM Sans', kind: 'sans' },
  { name: 'Poppins', kind: 'sans' },
  { name: 'Nunito', kind: 'sans' },
  { name: 'Space Grotesk', kind: 'sans' },
  { name: 'Lora', kind: 'serif' },
  { name: 'Merriweather', kind: 'serif' },
  { name: 'JetBrains Mono', kind: 'mono' }
]

const fallbackStacks = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
}

// Only plain names are allowed. The name ends up in a URL and in CSS, so this keeps
// anything unexpected (quotes, semicolons, ...) out of both.
export function isValidFontName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9 ]{2,40}$/.test(name.trim())
}

export function loadPrefs() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? '{}'))
  } catch {
    return { ...defaultPrefs }
  }
}

export function savePrefsLocally(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* not critical */
  }
}

// Settings can come from localStorage or from the user's account, so never trust their shape.
export function sanitize(raw) {
  const prefs = { ...defaultPrefs }
  if (!raw || typeof raw !== 'object') return prefs
  for (const name of COLOR_NAMES) {
    if (isHexColor(raw[name])) prefs[name] = raw[name].toLowerCase()
  }
  if (isValidFontName(raw.font)) prefs.font = raw.font.trim()
  if (typeof raw.confetti === 'boolean') prefs.confetti = raw.confetti
  return prefs
}

// Setting a CSS variable directly on <html> beats the theme's own value,
// and removing it hands control back to the theme.
export function applyColors(prefs) {
  const style = document.documentElement.style
  for (const name of COLOR_NAMES) {
    const hex = prefs[name]
    if (hex) {
      style.setProperty(`--color-${name}`, hex)
      style.setProperty(`--color-${name}-content`, readableTextOn(hex)) // text on buttons stays readable
    } else {
      style.removeProperty(`--color-${name}`)
      style.removeProperty(`--color-${name}-content`)
    }
  }
}

const loadedFonts = new Set()

// Adds the Google Fonts stylesheet for `name` (once) and resolves when the font is usable.
// Some fonts only come in one weight and Google rejects a request for weights that don't
// exist, so if the first attempt fails we retry without asking for specific weights.
function loadGoogleFont(name) {
  const family = encodeURIComponent(name.trim()).replace(/%20/g, '+')

  const addStylesheet = (href) =>
    new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.onload = resolve
      link.onerror = () => {
        link.remove()
        reject(new Error('stylesheet failed'))
      }
      document.head.appendChild(link)
    })

  return addStylesheet(`https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`)
    .catch(() => addStylesheet(`https://fonts.googleapis.com/css2?family=${family}&display=swap`))
    .then(() => document.fonts.load(`16px "${name.trim()}"`))
    .then((faces) => {
      if (!faces.length) throw new Error('font not found')
      loadedFonts.add(name)
    })
}

// Applies the chosen font everywhere. Throws if it is not a real Google Font, so the
// caller can tell the user instead of silently falling back to the default.
export async function applyFont(name) {
  const style = document.documentElement.style
  if (!name) {
    style.removeProperty('--font-sans')
    return
  }
  if (!loadedFonts.has(name)) {
    try {
      await loadGoogleFont(name)
    } catch {
      throw new Error(`"${name}" could not be loaded. Check the spelling against fonts.google.com.`)
    }
  }
  const kind = FONT_PRESETS.find((f) => f.name === name)?.kind ?? 'sans'
  style.setProperty('--font-sans', `"${name}", ${fallbackStacks[kind]}`)
}
