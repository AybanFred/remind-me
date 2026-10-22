import { describe, it, expect } from 'vitest'
import { addItems, timeAgo, MAX_ITEMS } from '../lib/notifications'

describe('addItems', () => {
  it('puts new items at the top, newest first', () => {
    const list = addItems([{ id: 1 }], [{ id: 2 }, { id: 3 }])
    expect(list.map((n) => n.id)).toEqual([3, 2, 1])
  })

  it(`keeps at most ${MAX_ITEMS} items`, () => {
    const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({ id: i }))
    expect(addItems([], many)).toHaveLength(MAX_ITEMS)
  })
})

describe('timeAgo', () => {
  const now = new Date(2026, 9, 22, 12, 0)
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

  it('shows short relative times', () => {
    expect(timeAgo(ago(10), now)).toBe('just now')
    expect(timeAgo(ago(5 * 60), now)).toBe('5m')
    expect(timeAgo(ago(3 * 3600), now)).toBe('3h')
    expect(timeAgo(ago(2 * 86400), now)).toBe('2d')
  })
})
