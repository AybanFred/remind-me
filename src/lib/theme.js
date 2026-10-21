// daisyUI themes are switched by putting data-theme="name" on the <html> element.
// We remember the choice in localStorage so it survives a refresh.

import { ref } from 'vue'

// 'remind' and 'remind-dark' are our own brand themes (defined in assets/main.css).
export const themes = ['remind', 'remind-dark', 'light', 'dark', 'cupcake', 'emerald', 'dracula', 'nord', 'sunset', 'synthwave']

// Friendly names (the rest are just capitalised).
export const themeLabels = { remind: 'Remind Me (light)', 'remind-dark': 'Remind Me (dark)' }

const KEY = 'theme'

export function getSavedTheme() {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

// The current theme, shared by every theme picker so they always agree
// ('' means "follow the system").
export const currentTheme = ref(getSavedTheme())

export function applyTheme(name) {
  currentTheme.value = name
  try {
    if (name) localStorage.setItem(KEY, name)
    else localStorage.removeItem(KEY)
  } catch {
    /* not critical */
  }
  if (name) {
    document.documentElement.setAttribute('data-theme', name)
  } else {
    // Empty = follow the operating system's light/dark setting.
    document.documentElement.removeAttribute('data-theme')
  }
}
