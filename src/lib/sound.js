// A short three-note chime made with the browser's audio engine, so no sound file is needed.
// Browsers only allow audio after the user has interacted with the page, so unlockAudio()
// is called when the user presses Start, and playChime() can then play later on its own.

let context = null

export function unlockAudio() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)()
    if (context.state === 'suspended') context.resume()
  } catch {
    /* audio is a nice-to-have */
  }
}

export function playChime() {
  if (!context) return
  try {
    const notes = [660, 880, 1100] // Hz
    notes.forEach((frequency, i) => {
      const start = context.currentTime + i * 0.22
      const oscillator = context.createOscillator()
      const volume = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      // quick fade in and out so the notes don't click
      volume.gain.setValueAtTime(0.0001, start)
      volume.gain.exponentialRampToValueAtTime(0.25, start + 0.03)
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.4)
      oscillator.connect(volume).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.45)
    })
  } catch {
    /* ignore */
  }
}
