import confetti from 'canvas-confetti'
import { cssColorToHex } from '@/lib/color'

// The confetti uses the colours of the current theme (including any custom colours),
// so every theme gets its own celebration.
function themeColors() {
  const css = getComputedStyle(document.documentElement)
  return ['--color-primary', '--color-secondary', '--color-accent', '--color-success']
    .map((name) => css.getPropertyValue(name).trim())
    .filter(Boolean)
    .map(cssColorToHex)
}

// `tier` sets the size of the celebration, `origin` is where it starts ({ x, y } from 0 to 1).
// canvas-confetti skips everything for people who have "reduce motion" turned on.
export function celebrate(tier, origin = { x: 0.5, y: 0.65 }) {
  const base = { colors: themeColors(), origin, zIndex: 1000, disableForReducedMotion: true }

  if (tier === 'small') {
    confetti({ ...base, particleCount: 45, spread: 60, startVelocity: 32, scalar: 0.9, ticks: 140 })
    return
  }

  if (tier === 'medium') {
    confetti({ ...base, particleCount: 70, angle: 60, spread: 65, startVelocity: 45 })
    confetti({ ...base, particleCount: 70, angle: 120, spread: 65, startVelocity: 45 })
    return
  }

  // big: a burst from the middle, then cannons from both sides for about a second
  confetti({ ...base, particleCount: 140, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.6 } })
  const end = Date.now() + 1100
  const sides = () => {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } })
    confetti({ ...base, particleCount: 6, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } })
    if (Date.now() < end) requestAnimationFrame(sides)
  }
  sides()
}
