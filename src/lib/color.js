// Small colour helpers used by the appearance settings and the confetti.

export function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// How bright a colour looks to the eye (WCAG "relative luminance"), 0 = black, 1 = white.
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// Text sitting ON a coloured button must stay readable: pick white or near-black,
// whichever contrasts better with the button colour.
export function readableTextOn(hex) {
  const dark = '#111827'
  const white = '#ffffff'
  return contrastRatio(hex, white) >= contrastRatio(hex, dark) ? white : dark
}

// Turns any CSS colour the browser understands (hex, rgb(), oklch(), ...) into "#rrggbb".
// The theme colours are written in oklch, but <input type="color"> and the confetti need hex.
// A 1x1 canvas does the conversion for us.
export function cssColorToHex(value) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000000' // used if `value` is not a valid colour
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}
