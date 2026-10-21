// daisyUI themes are switched by putting data-theme="name" on the <html> element.
// We remember the choice in localStorage so it survives a refresh.

// 'remind' and 'remind-dark' are our own brand themes (defined in assets/main.css).
export const themes = ['remind', 'remind-dark', 'light', 'dark', 'cupcake', 'emerald', 'dracula', 'nord', 'sunset', 'synthwave']

const KEY = 'theme'

export function getSavedTheme() {
  return localStorage.getItem(KEY) ?? ''
}

export function applyTheme(name) {
  if (name) {
    document.documentElement.setAttribute('data-theme', name)
    localStorage.setItem(KEY, name)
  } else {
    // Empty = follow the operating system's light/dark setting.
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem(KEY)
  }
}
