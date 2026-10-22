import { describe, it, expect } from 'vitest'
import { shouldSendWelcome } from '../lib/welcome'

const now = new Date(2026, 9, 22, 12, 0).getTime()
const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString()
const user = (over = {}) => ({
  email: 'a@b.com',
  created_at: hoursAgo(1),
  user_metadata: {},
  ...over
})

describe('shouldSendWelcome', () => {
  it('welcomes an account created a moment ago', () => {
    expect(shouldSendWelcome(user(), now)).toBe(true)
  })

  it('does not welcome an older account', () => {
    expect(shouldSendWelcome(user({ created_at: hoursAgo(30) }), now)).toBe(false)
  })

  it('does not send twice once the welcome is recorded', () => {
    expect(
      shouldSendWelcome(user({ user_metadata: { welcome_sent_at: hoursAgo(0.5) } }), now)
    ).toBe(false)
  })

  it('does nothing without a user or an email', () => {
    expect(shouldSendWelcome(null, now)).toBe(false)
    expect(shouldSendWelcome(user({ email: '' }), now)).toBe(false)
  })
})
